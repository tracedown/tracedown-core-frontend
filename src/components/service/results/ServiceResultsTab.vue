<template>
    <!--  Two columns on desktop; on a phone the list sits above the detail —
          a third of 390px cannot hold "284ms · 6m ago · us-west-1".  -->
    <div class="flex gap-4 max-md:flex-col max-md:gap-3">
      <!-- Result list -->
      <div class="w-1/3 flex flex-col max-md:w-full">
        <LoadingState v-if="resultStore.loading" compact />

        <EmptyState
          v-else-if="resultStore.results.length === 0"
          compact
          :message="t('results.noResults')"
        />

        <TransitionGroup
          v-else
          name="result-item"
          tag="div"
          class="flex-1 overflow-y-auto space-y-1 max-md:max-h-72"
        >
          <ResultListItem
            v-for="result in resultStore.results"
            :key="result.id"
            :result="result"
            :selected="selectedResultId === result.id"
            @select="selectResult(result.id)"
          />
        </TransitionGroup>

        <!-- Pagination -->
        <div
          v-if="resultStore.results.length > 0"
          class="flex items-center justify-between mt-2 pt-2 border-t border-text-secondary/50"
        >
          <IconButton
            :fa-icon="faChevronLeft"
            :disabled="page <= 1"
            icon-class="w-3 h-3"
            @click="changePage(page - 1)"
          />
          <span class="text-xs text-text-secondary">{{ page }}</span>
          <IconButton
            :fa-icon="faChevronRight"
            :disabled="!hasNextPage"
            icon-class="w-3 h-3"
            @click="changePage(page + 1)"
          />
        </div>
      </div>

      <!-- Result detail -->
      <div class="w-2/3 flex flex-col min-w-0 max-md:w-full">
        <ResultDetail />
      </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import IconButton from '@/components/core/buttons/IconButton.vue';
import ResultListItem from '@/components/service/results/ResultListItem.vue';
import ResultDetail from '@/components/service/results/ResultDetail.vue';
import { useResultStore } from '@/store/core/result';
import { useNotificationStore } from '@/store/ui/notifications';
import type { ServiceSummary } from '@/data/services/ServiceDto';
import LoadingState from '@/components/core/LoadingState.vue';
import EmptyState from '@/components/core/EmptyState.vue';

const PAGE_SIZE = 12;

const props = defineProps<{
  service: ServiceSummary;
  /** Incremented by the parent on each live probe.completed event. */
  liveTick: number;
}>();

const { t } = useI18n();
const resultStore = useResultStore();
const notifications = useNotificationStore();

const page = ref<number>(1);
const selectedResultId = ref<string | null>(null);

const hasNextPage = computed(() => resultStore.totalResults > page.value * PAGE_SIZE);

// Request generations: only the newest selection/page fetch may apply its
// outcome — rapid clicks would otherwise report or revert out of order.
let selectSeq = 0;
let pageSeq = 0;

async function selectResult(resultId: string) {
  const previous = selectedResultId.value;
  const seq = ++selectSeq;
  selectedResultId.value = resultId;
  resultStore.clearStepBody();
  const result = await resultStore.fetchResultDetail(props.service.id, resultId);
  if (seq !== selectSeq) return; // superseded — the latest click wins
  if (!result.ok) {
    // The detail pane still shows the previous selection; move the highlight
    // back so the two can't disagree.
    selectedResultId.value = previous;
    notifications.show(result.message ?? t('common.states.error'), 'error');
  }
}

async function changePage(next: number) {
  const previous = page.value;
  const seq = ++pageSeq;
  page.value = next;
  selectedResultId.value = null;
  resultStore.clearSelection();
  const result = await resultStore.fetchResults(props.service.id, next, PAGE_SIZE);
  if (seq !== pageSeq) return;
  if (!result.ok) {
    // The list still holds the previous page's items — revert the indicator.
    page.value = previous;
    notifications.show(result.message ?? t('common.states.error'), 'error');
  }
}

// Live probes prepend to the first page.
watch(() => props.liveTick, () => {
  if (page.value === 1) {
    void resultStore.prependNewResults(props.service.id, PAGE_SIZE);
  }
});

onMounted(() => {
  void resultStore.fetchResults(props.service.id, 1, PAGE_SIZE);
});
</script>

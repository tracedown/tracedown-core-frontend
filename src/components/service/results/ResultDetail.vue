<template>
    <LoadingState v-if="resultStore.selectedResultLoading" compact />

    <div
      v-else-if="!result"
      class="flex items-center justify-center h-full"
    >
      <p class="text-text-secondary text-xs">
        {{ t('results.selectResult') }}
      </p>
    </div>

    <div
      v-else
      class="flex-1 overflow-y-auto"
    >
      <div
        v-if="result.status === 'skipped'"
        class="rounded-lg border border-status-warning/40 bg-status-warning/5 p-3 mb-3"
      >
        <p class="text-sm text-text-primary">
          {{ skippedMessage }}
        </p>
      </div>

      <TabBar
        v-model="activeTab"
        :tabs="tabs"
        class="mb-3"
      />

      <div
        v-if="activeTab === 'calls'"
        class="space-y-2"
      >
        <ResultStepRow
          v-for="step in result.steps"
          :key="step.id"
          :step="step"
          :service-id="result.serviceId"
          :result-id="result.id"
          :expanded="expandedStepId === step.id"
          @toggle="toggleStep(step.id)"
        />
      </div>

      <JsonViewer
        v-if="activeTab === 'raw'"
        :data="result.rawResult"
      />
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, defineAsyncComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import TabBar from '@/components/core/TabBar.vue';
import LoadingSpinner from '@/components/core/LoadingSpinner.vue';
import ResultStepRow from '@/components/service/results/ResultStepRow.vue';
import { useResultStore } from '@/store/core/result';
import type { DisplayTab } from '@/types/ui/tabs';
import LoadingState from '@/components/core/LoadingState.vue';

/** Detail pane of the selected probe result: per-call steps or the raw JSON. */
// Shares CodeMirror with the editor chunk — load on demand.
const JsonViewer = defineAsyncComponent({
  loader: () => import('@/components/core/JsonViewer.vue'),
  loadingComponent: LoadingSpinner,
});

const { t } = useI18n();
const resultStore = useResultStore();

const activeTab = ref<string>('calls');
const expandedStepId = ref<string | null>(null);

const result = computed(() => resultStore.selectedResult);

const tabs = computed<DisplayTab[]>(() => [
  { key: 'calls', label: t('results.calls') },
  { key: 'raw', label: t('results.rawResult') },
]);

/** Reason-specific explanation for skipped probes (raw_result.reason). */
const skippedMessage = computed(() => {
  const reason = result.value?.rawResult?.reason;
  if (reason === 'dispatch_queue_full' || reason === 'dispatch_backlog') {
    return t('results.skippedQueueFull');
  }
  // The target asked not to be probed. Nothing is wrong with the service or
  // the platform, so the generic "never dispatched" line would leave the
  // reader looking for a fault that is not there.
  if (reason === 'target_opted_out') {
    return t('results.skippedTargetOptedOut');
  }
  return t('results.skippedGeneric');
});

function toggleStep(stepId: string) {
  expandedStepId.value = expandedStepId.value === stepId ? null : stepId;
  resultStore.clearStepBody();
}

// New selection: reset to the calls tab with everything collapsed.
watch(() => result.value?.id, () => {
  activeTab.value = 'calls';
  expandedStepId.value = null;
});
</script>

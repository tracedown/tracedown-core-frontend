<template>
    <div class="border border-text-secondary/50 overflow-hidden">
      <!-- Call header (always visible, click to expand) -->
      <button
        class="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-background-secondary/50 transition-colors"
        @click="emit('toggle')"
      >
        <span class="text-text-secondary font-medium flex-shrink-0">{{ step.stepNum }}</span>
        <!-- min-w-0: a flex item will not shrink below its content, so without
             it the URL sets the row's width instead of truncating. -->
        <span class="text-text-primary truncate min-w-0">{{ step.requestUrl }}</span>
        <span
          v-if="step.statusCode"
          class="flex-shrink-0 font-mono"
          :class="step.statusCode < 400 ? 'text-status-success' : 'text-status-failure'"
        >
          {{ step.statusCode }}
        </span>
        <span
          v-if="step.error"
          class="text-status-failure flex-shrink-0"
        >
          {{ t('common.states.error') }}
        </span>
        <span
          v-if="step.responseTimeMs != null"
          class="text-text-secondary ml-auto flex-shrink-0 font-mono"
        >
          {{ step.responseTimeMs }}ms
        </span>
        <FontAwesomeIcon
          :icon="faChevronRight"
          class="w-2.5 h-2.5 text-text-secondary transition-transform flex-shrink-0"
          :class="expanded ? 'rotate-90' : ''"
        />
      </button>

      <ResultStepDetail
        v-if="expanded"
        :step="step"
        :service-id="serviceId"
        :result-id="resultId"
      />
    </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import ResultStepDetail from '@/components/service/results/ResultStepDetail.vue';
import type { ProbeStepSummary } from '@/data/results/ResultDto';

defineProps<{
  step: ProbeStepSummary;
  serviceId: string;
  resultId: string;
  expanded: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();

const { t } = useI18n();
</script>

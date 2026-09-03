<template>
    <div class="px-3 pb-3 space-y-3 border-t border-text-secondary/50 bg-background-primary/50">
      <!-- Timing breakdown -->
      <div
        v-if="step.dnsMs != null || step.connectMs != null"
        class="grid grid-cols-5 gap-2 text-xs pt-2 max-md:grid-cols-3"
      >
        <div
          v-for="phase in timingPhases"
          :key="phase.label"
        >
          <span class="text-text-secondary">{{ phase.label }}</span>
          <p class="text-text-primary font-mono mt-0.5">
            {{ phase.ms ?? 0 }}ms
          </p>
        </div>
      </div>
      <p class="text-xs text-text-secondary/50">
        {{ t('results.timingOverlapNote') }}
      </p>

      <!-- Size -->
      <div
        v-if="step.responseSizeBytes != null"
        class="text-xs"
      >
        <span class="text-text-secondary">{{ t('results.size') }}: </span>
        <span class="text-text-primary font-mono">{{ (step.responseSizeBytes / 1024).toFixed(1) }} KB</span>
      </div>

      <!-- Error -->
      <div
        v-if="step.error"
        class="text-xs text-status-failure bg-status-failure/5 rounded p-2"
      >
        {{ step.error }}
      </div>

      <!-- Assertions -->
      <div
        v-if="assertions.length > 0"
        class="text-xs space-y-1"
      >
        <p class="text-text-secondary font-medium">
          {{ t('results.assertions') }}
        </p>
        <div
          v-for="(a, i) in assertions"
          :key="i"
          class="flex items-center gap-2 px-2 py-1 max-md:flex-wrap"
          :class="a.outcome === 'passed' ? 'bg-status-success/5' : 'bg-status-failure/5'"
        >
          <span
            class="w-1.5 h-1.5 rounded-full flex-shrink-0"
            :class="a.outcome === 'passed' ? 'bg-status-success' : 'bg-status-failure'"
          />
          <span class="text-text-primary font-medium">{{ a.scope }}</span>
          <span class="text-text-secondary">{{ a.op }}</span>
          <span class="text-text-primary font-mono break-all">{{ a.expected }}</span>
          <template v-if="a.outcome === 'failed'">
            <span class="text-text-secondary">→</span>
            <span class="text-status-failure font-mono break-all">{{ a.actual }}</span>
          </template>
          <span
            class="ml-auto"
            :class="a.outcome === 'passed' ? 'text-status-success' : 'text-status-failure'"
          >
            {{ a.outcome }}
          </span>
        </div>
      </div>

      <!-- Headers (collapsible) -->
      <details
        v-if="step.headers"
        class="text-xs"
      >
        <summary class="text-text-secondary font-medium cursor-pointer select-none hover:text-text-primary transition-colors">
          {{ t('results.headers') }}
        </summary>
        <div class="mt-1">
          <JsonViewer :data="step.headers" />
        </div>
      </details>

      <!-- Response body -->
      <div class="text-xs">
        <template v-if="step.hasBody">
          <LinkButton
            v-if="!bodyVisible"
            :label-text="t('results.viewBody')"
            @click="showBody"
          />
          <div v-else>
            <div class="flex items-center justify-between mb-1">
              <p class="text-text-secondary font-medium">
                {{ t('results.responseBody') }}
              </p>
              <LinkButton
                :label-text="t('common.actions.hide')"
                color-class="text-text-secondary hover:text-text-primary"
                @click="hideBody"
              />
            </div>
            <p
              v-if="resultStore.stepBodyLoading"
              class="text-text-secondary"
            >
              {{ t('common.states.loading') }}
            </p>
            <pre
              v-else
              class="bg-background-primary p-2 overflow-x-auto max-h-64 text-text-primary font-mono text-xs"
            >{{ resultStore.stepBody }}</pre>
          </div>
        </template>
        <span
          v-else
          class="text-text-secondary italic"
        >
          {{ bodyUnavailableText }}
        </span>
      </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, defineAsyncComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import LinkButton from '@/components/core/buttons/LinkButton.vue';
import LoadingSpinner from '@/components/core/LoadingSpinner.vue';
import { parseAssertions } from '@/utils/assertions';
import { useResultStore } from '@/store/core/result';
import type { ProbeStepSummary } from '@/data/results/ResultDto';

const props = defineProps<{
  step: ProbeStepSummary;
  serviceId: string;
  resultId: string;
}>();

// Shares CodeMirror with the editor chunk — load on demand.
const JsonViewer = defineAsyncComponent({
  loader: () => import('@/components/core/JsonViewer.vue'),
  loadingComponent: LoadingSpinner,
});

const { t } = useI18n();
const resultStore = useResultStore();

const bodyVisible = ref<boolean>(false);

const assertions = computed(() => parseAssertions(props.step.assertionResults));

const timingPhases = computed(() => [
  { label: t('metrics.dns'), ms: props.step.dnsMs },
  { label: t('metrics.connect'), ms: props.step.connectMs },
  { label: t('metrics.tls'), ms: props.step.tlsMs },
  { label: t('metrics.ttfb'), ms: props.step.ttfbMs },
  { label: t('metrics.transfer'), ms: props.step.transferMs },
]);

const bodyUnavailableText = computed(() =>
  props.step.bodyNotStoredReason
    ? `${t('results.bodyNotStored')}: ${props.step.bodyNotStoredReason}`
    : t('results.bodySavingDisabled'));

function showBody() {
  bodyVisible.value = true;
  void resultStore.fetchStepBody(props.serviceId, props.resultId, props.step.id);
}

function hideBody() {
  bodyVisible.value = false;
  resultStore.clearStepBody();
}
</script>

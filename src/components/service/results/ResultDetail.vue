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

      <!-- What the reader needs before opening anything: when exactly this
           ran, on which agent, how long it took. The history row shows "5m
           ago" for the last hour, which is not a time a reader can write into
           an incident note; the exact instant belongs here. -->
      <div class="mb-3 rounded-lg border border-text-secondary/20 bg-background-primary/40 px-3 py-2 text-xs">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span class="flex items-center gap-1.5">
            <span
              class="inline-block w-2 h-2 rounded-full flex-shrink-0"
              :class="statusDotClass(result.status)"
            />
            <span class="text-text-primary font-medium">{{ result.status }}</span>
          </span>
          <span class="text-text-primary tabular-nums">{{ formatDateTime(result.startedAt, { seconds: true }) }}</span>
          <span class="text-text-secondary">{{ formatAgo(result.startedAt) }}</span>
          <span
            v-if="agentSlug"
            class="text-text-secondary ml-auto"
          >
            {{ t('results.summary.agent') }}
            <span class="text-text-primary">{{ agentSlug }}</span>
          </span>
        </div>
        <dl
          v-if="result.status !== 'skipped'"
          class="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-text-secondary"
        >
          <div>
            <dt class="inline">
              {{ t('results.summary.runTime') }}
            </dt>
            <dd class="inline text-text-primary tabular-nums ml-1">
              {{ formatMs(result.runDurationMs) }}
            </dd>
          </div>
          <div v-if="responseMs != null">
            <dt class="inline">
              {{ t('results.summary.responseTime') }}
            </dt>
            <dd class="inline text-text-primary tabular-nums ml-1">
              {{ formatMs(responseMs) }}
            </dd>
          </div>
          <div>
            <dt class="inline">
              {{ t('results.summary.calls') }}
            </dt>
            <dd class="inline text-text-primary tabular-nums ml-1">
              {{ result.steps.length }}<span
                v-if="failedCalls > 0"
                class="text-status-failure"
              > ({{ t('results.summary.failedCount', { n: failedCalls }) }})</span>
            </dd>
          </div>
          <div v-if="assertionTotal > 0">
            <dt class="inline">
              {{ t('results.assertions') }}
            </dt>
            <dd
              class="inline tabular-nums ml-1"
              :class="assertionFailed > 0 ? 'text-status-failure' : 'text-text-primary'"
            >
              {{ assertionTotal - assertionFailed }}/{{ assertionTotal }}
            </dd>
          </div>
          <div v-if="totalBytes > 0">
            <dt class="inline">
              {{ t('results.size') }}
            </dt>
            <dd class="inline text-text-primary tabular-nums ml-1">
              {{ formatBytes(totalBytes) }}
            </dd>
          </div>
        </dl>
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
          :service-name="serviceName"
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
import { useRelativeTime } from '@/composables/useRelativeTime';
import { formatDateTime } from '@/lib/dateFormat';
import { formatBytes, formatMs, statusDotClass } from '@/lib/metrics-utils';
import { parseAssertions } from '@/utils/assertions';
import type { DisplayTab } from '@/types/ui/tabs';
import LoadingState from '@/components/core/LoadingState.vue';

/** Detail pane of the selected probe result: per-call steps or the raw JSON. */
// Shares CodeMirror with the editor chunk — load on demand.
const JsonViewer = defineAsyncComponent({
  loader: () => import('@/components/core/JsonViewer.vue'),
  loadingComponent: LoadingSpinner,
});

const { t } = useI18n();
defineProps<{
  /** Names a downloaded response body; optional. */
  serviceName?: string;
}>();

const resultStore = useResultStore();

const activeTab = ref<string>('calls');
const expandedStepId = ref<string | null>(null);

const result = computed(() => resultStore.selectedResult);

const { formatAgo } = useRelativeTime();

// The detail carries the agent's id only; its slug is on the history row the
// reader clicked, which the list still holds.
const agentSlug = computed(() => {
  const id = result.value?.id;
  return id ? resultStore.results.find((r) => r.id === id)?.agentSlug ?? null : null;
});

/** Sum of the calls' response times, or null when no call reported one. */
const responseMs = computed(() => {
  const times = (result.value?.steps ?? []).map((s) => s.responseTimeMs).filter((v): v is number => v != null);
  return times.length > 0 ? times.reduce((a, b) => a + b, 0) : null;
});

/** Calls that errored, answered 4xx/5xx, or failed an assertion. */
const failedCalls = computed(() =>
  (result.value?.steps ?? []).filter((s) =>
    s.error != null ||
    (s.statusCode != null && s.statusCode >= 400) ||
    parseAssertions(s.assertionResults).some((a) => a.outcome === 'failed'),).length,);

const assertionTotal = computed(() =>
  (result.value?.steps ?? []).reduce((n, s) => n + parseAssertions(s.assertionResults).length, 0),);

const assertionFailed = computed(() =>
  (result.value?.steps ?? []).reduce(
    (n, s) => n + parseAssertions(s.assertionResults).filter((a) => a.outcome === 'failed').length,
    0,
  ),);

const totalBytes = computed(() =>
  (result.value?.steps ?? []).reduce((n, s) => n + (s.responseSizeBytes ?? 0), 0),);

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

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
        <span class="text-text-primary font-mono">{{ formatBytes(step.responseSizeBytes) }}</span>
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
          <div
            v-if="!body.visible.value"
            class="flex items-center gap-3 max-md:flex-wrap"
          >
            <!-- Only offered when there is something to open. A body past the
                 display limit is never fetched just to be refused, so the
                 download is the only thing on offer for one. -->
            <LinkButton
              v-if="body.recordedDisplay.value !== 'too-large'"
              :label-text="t('results.viewBody')"
              @click="body.show"
            />
            <span
              v-else
              class="text-text-secondary"
            >{{ t('results.bodyTooLargeToShow') }}</span>
            <LinkButton
              :fa-icon="faDownload"
              :label-text="body.downloading.value ? t('common.states.loading') : t('results.downloadBody')"
              color-class="text-text-secondary hover:text-accent-primary"
              @click="body.download"
            />
          </div>
          <div v-else>
            <div class="flex items-center justify-between gap-3 mb-1">
              <p class="text-text-secondary font-medium">
                {{ t('results.responseBody') }}
              </p>
              <div class="flex items-center gap-3">
                <LinkButton
                  :fa-icon="faDownload"
                  :label-text="body.downloading.value ? t('common.states.loading') : t('results.downloadBody')"
                  color-class="text-text-secondary hover:text-accent-primary"
                  @click="body.download"
                />
                <LinkButton
                  :label-text="t('common.actions.hide')"
                  color-class="text-text-secondary hover:text-text-primary"
                  @click="body.hide"
                />
              </div>
            </div>
            <p
              v-if="resultStore.stepBodyLoading"
              class="text-text-secondary"
            >
              {{ t('common.states.loading') }}
            </p>
            <p
              v-else-if="resultStore.stepBodyFailed"
              class="text-status-failure"
            >
              {{ resultStore.stepBodyError ?? t('results.bodyLoadFailed') }}
            </p>
            <!-- Bigger than the step said it would be. Nothing is drawn: the
                 download above is the way to read it. -->
            <p
              v-else-if="body.display.value === 'too-large'"
              class="text-text-secondary"
            >
              {{ t('results.bodyTooLargeToShow') }}
            </p>
            <!-- A binary body is not text and is not pretended to be: it
                 arrives as bytes, so it is described and shown as bytes. -->
            <template v-else-if="body.display.value === 'binary' && body.binary.value">
              <p class="text-text-secondary">
                {{ body.binary.value!.notice }}
              </p>
              <pre
                v-if="body.binary.value!.preview"
                class="bg-background-primary p-2 overflow-x-auto max-h-64 text-text-primary font-mono text-xs"
              >{{ body.binary.value!.preview }}</pre>
            </template>
            <!-- JSON keeps hard line breaks and scrolls sideways: it has been
                 laid out, so its lines are already short, and wrapping them
                 would only break the indentation that makes it readable.
                 Anything else may well be one enormous line — minified markup,
                 a bundle — so it wraps instead of running off the pane. -->
            <pre
              v-else
              class="bg-background-primary p-2 overflow-x-auto max-h-64 text-text-primary font-mono text-xs"
              :class="body.display.value === 'format' ? 'whitespace-pre' : 'whitespace-pre-wrap break-all'"
            >{{ body.shown.value }}</pre>
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
import { computed, defineAsyncComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import { faDownload } from '@fortawesome/free-solid-svg-icons';
import LinkButton from '@/components/core/buttons/LinkButton.vue';
import LoadingSpinner from '@/components/core/LoadingSpinner.vue';
import { formatBytes } from '@/lib/metrics-utils';
import { parseAssertions } from '@/utils/assertions';
import { bodyNotStoredPrefixKey } from '@/utils/resultBodies';
import { useStepBody } from '@/composables/useStepBody';
import { useResultStore } from '@/store/core/result';
import type { ProbeStepSummary } from '@/data/results/ResultDto';

const props = defineProps<{
  step: ProbeStepSummary;
  serviceId: string;
  resultId: string;
  /** Names the downloaded file; optional, so a lone step still saves sensibly. */
  serviceName?: string;
}>();

// Shares CodeMirror with the editor chunk — load on demand.
const JsonViewer = defineAsyncComponent({
  loader: () => import('@/components/core/JsonViewer.vue'),
  loadingComponent: LoadingSpinner,
});

const { t, te } = useI18n();
const resultStore = useResultStore();

/** Everything about the response body: what to draw, and how to save it. */
const body = useStepBody(
  () => props.step,
  () => ({ serviceId: props.serviceId, resultId: props.resultId, serviceName: props.serviceName }),
);

const assertions = computed(() => parseAssertions(props.step.assertionResults));

const timingPhases = computed(() => [
  { label: t('metrics.dns'), ms: props.step.dnsMs },
  { label: t('metrics.connect'), ms: props.step.connectMs },
  { label: t('metrics.tls'), ms: props.step.tlsMs },
  { label: t('metrics.ttfb'), ms: props.step.ttfbMs },
  { label: t('metrics.transfer'), ms: props.step.transferMs },
]);

/**
 * The reason a body is missing, in words. Known codes get a sentence (the raw
 * `notRequested` read as a fault when the real cause was an unverified
 * target); an unknown code is shown as-is rather than hidden. The prefix
 * follows the reason: a body that was kept and has gone since is "no longer
 * stored", not "not stored".
 */
const bodyUnavailableText = computed(() => {
  const reason = props.step.bodyNotStoredReason;
  if (!reason) return t('results.bodySavingDisabled');
  const key = `results.bodyReasons.${reason}`;
  return `${t(bodyNotStoredPrefixKey(reason))}: ${te(key) ? t(key) : reason}`;
});
</script>

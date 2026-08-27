import { ref } from 'vue';
import { defineStore } from 'pinia';
import { http } from '@/config/requests';
import type { HourlyBucket, MetricsDelta } from '@/data/metrics/MetricsDto';
import type { ActionResult } from '@/types/actions';

/** Resource kinds exposing rolled-up metrics endpoints. */
type MetricsResourceType = 'workspaces' | 'projects';

/**
 * Header metrics of the currently viewed resource (workspace or project):
 * the recent hourly history driving the header chart, kept ticking between
 * refetches by live probe/delta fold-ins. Fetches are keyed by resource —
 * repeat calls for the same resource are free; a different resource drops
 * the stale values before refetching.
 */
export const useMetricsStore = defineStore('metrics', () => {
  const history = ref<HourlyBucket[]>([]);
  /** True while the header history is being fetched for a new context. */
  const historyLoading = ref<boolean>(false);
  const historyKey = ref<string | null>(null);

  /** Monotonic fetch generation — a superseded response is discarded on arrival. */
  let generation = 0;

  /**
   * Synchronously drops values belonging to a different resource. Views call
   * this first on navigation so no stale frame ever renders.
   */
  function ensureContext(resourceType: MetricsResourceType, resourceId: string) {
    const prefix = `${resourceType}:${resourceId}`;
    if (historyKey.value !== null && !historyKey.value.startsWith(`${prefix}:`)) {
      history.value = [];
      historyKey.value = null;
    }
  }

  /**
   * Background fetch — the aggregate can take seconds on large fleets, so it
   * must never drive the global loading overlay or block navigation; the
   * chart shows a local spinner via [historyLoading] instead.
   */
  async function fetchHistory(
    resourceType: MetricsResourceType,
    resourceId: string,
    hours = 24,
    force = false,
  ): Promise<ActionResult> {
    const key = `${resourceType}:${resourceId}:${hours}`;
    if (!force && historyKey.value === key) return { ok: true };
    if (historyKey.value !== key) history.value = [];
    const gen = ++generation;

    historyLoading.value = true;
    try {
      const res = await http.get<HourlyBucket[]>(
        `/${resourceType}/${resourceId}/metrics/history?hours=${hours}`,
        { disableLoading: true },
      );
      // A newer fetch superseded this one — a slow stale response must not
      // overwrite fresher data, nor re-point [historyKey] (which would also
      // mute the live recordProbe/recordDelta fold-ins for the new context).
      if (gen !== generation) return { ok: true };
      if (!res.success || !res.data) {
        // Deliberately not cached as loaded — a revisit retries the fetch.
        return { ok: false, message: res.errorInfo?.message };
      }
      history.value = res.data;
      historyKey.value = key;
      return { ok: true };
    } finally {
      if (gen === generation) historyLoading.value = false;
    }
  }

  /** Current UTC hour in the backend's bucket-key format (`yyyyMMddHH`). */
  function currentHourKey(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}${pad(now.getUTCHours())}`;
  }

  /**
   * Folds one live probe result into the current hourly bucket so the header
   * stats/chart tick in real time between refetches. No-op when the loaded
   * history belongs to a different resource.
   */
  function currentBucket(): HourlyBucket {
    const hour = currentHourKey();
    let bucket = history.value[history.value.length - 1];
    if (!bucket || bucket.hour !== hour) {
      bucket = { hour, total: 0, success: 0, failure: 0, timeout: 0, sumMs: 0, callCount: 0 };
      history.value.push(bucket);
    }
    return bucket;
  }

  function recordProbe(
    resourceType: MetricsResourceType,
    resourceId: string,
    status: string,
    avgResponseMs: number,
    callCount = 1,
  ) {
    if (!historyKey.value?.startsWith(`${resourceType}:${resourceId}:`)) return;
    // A skipped tick never ran, so it belongs in neither the numerator nor the
    // denominator — the server's buckets leave it out too.
    if (status === 'skipped') return;
    const bucket = currentBucket();
    bucket.total++;
    // `error` (a run that could not be evaluated) counts toward the total but
    // has no bucket of its own — matching the server, which counts it in the
    // probe total and in no success/failure/timeout bucket.
    if (status === 'success' || status === 'failure' || status === 'timeout') bucket[status]++;
    bucket.sumMs += avgResponseMs * Math.max(callCount, 1);
    bucket.callCount += Math.max(callCount, 1);
  }

  /** Folds a server-aggregated `metrics.delta` event into the current bucket. */
  function recordDelta(
    resourceType: MetricsResourceType,
    resourceId: string,
    delta: MetricsDelta,
  ) {
    if (!historyKey.value?.startsWith(`${resourceType}:${resourceId}:`)) return;
    const bucket = currentBucket();
    bucket.total += delta.total;
    bucket.success += delta.success;
    bucket.failure += delta.failure;
    bucket.timeout += delta.timeout;
    bucket.sumMs += delta.sumMs;
    bucket.callCount += delta.callCount;
  }

  function clear() {
    history.value = [];
    historyLoading.value = false;
    historyKey.value = null;
  }

  return { history, historyLoading, ensureContext, fetchHistory, recordProbe, recordDelta, clear };
});

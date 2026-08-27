import type { ServiceMetricsDto } from '@/data/metrics/MetricsDto';
import { successRateStyle } from '@/config/successRateColors';

/** Computes success rate (0–100) from metrics counters. Returns null if no data. */
export function computeSuccessRate(m: ServiceMetricsDto | null): number | null {
  if (!m || m.counters.probesTotal === 0) return null;
  return (m.counters.probesSuccess / m.counters.probesTotal) * 100;
}

/** Returns inline style for success rate text color from metrics. */
export function metricsSuccessStyle(m: ServiceMetricsDto | null): Record<string, string> {
  return successRateStyle(computeSuccessRate(m));
}

/** Formats milliseconds compactly: `840ms` / `1.24s`. */
export function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

/**
 * Formats a `probe_aggregates` bucket start (ISO-8601 UTC) for a chart x-axis:
 * local time-of-day for hourly buckets, local date for daily.
 */
export function formatBucketLabel(iso: string, bucketType: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return bucketType === 'daily'
    ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** Formats a byte count in binary units: `842 B` / `1.2 KB` / `3.45 MB` / `1.02 GB`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[unit]}`;
}

/** Formats a count with thousands separators: `12,480`. */
export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Sums counters across a page of resources and carries the state of the most
 * recently run one. Percentiles cannot be aggregated locally and stay null.
 * Returns null when no resource has metrics.
 */
export function aggregateMetrics(items: ReadonlyArray<{ metrics: ServiceMetricsDto | null }>): ServiceMetricsDto | null {
  let hasAny = false;
  const counters = { probesTotal: 0, probesSuccess: 0, probesFailure: 0, probesTimeout: 0 };
  let latest: ServiceMetricsDto['state'] = {
    lastStatus: null, lastConsecutive: 0, lastResponseMs: 0, lastRunAt: null,
  };

  for (const item of items) {
    const m = item.metrics;
    if (!m) continue;
    hasAny = true;
    counters.probesTotal += m.counters.probesTotal;
    counters.probesSuccess += m.counters.probesSuccess;
    counters.probesFailure += m.counters.probesFailure;
    counters.probesTimeout += m.counters.probesTimeout;
    if (m.state.lastRunAt != null && (latest.lastRunAt == null || m.state.lastRunAt > latest.lastRunAt)) {
      latest = { ...m.state };
    }
  }

  if (!hasAny) return null;
  return { counters, state: latest, percentiles: null };
}

/**
 * Returns new metrics with one probe outcome folded in: counters bumped and
 * the last-run state advanced. Used by live `probe.completed` updates.
 */
export function applyProbeToMetrics(
  m: ServiceMetricsDto | null | undefined,
  status: string,
  avgResponseMs: number,
): ServiceMetricsDto {
  return {
    counters: {
      probesTotal: (m?.counters.probesTotal ?? 0) + 1,
      probesSuccess: (m?.counters.probesSuccess ?? 0) + (status === 'success' ? 1 : 0),
      probesFailure: (m?.counters.probesFailure ?? 0) + (status === 'failure' ? 1 : 0),
      probesTimeout: (m?.counters.probesTimeout ?? 0) + (status === 'timeout' ? 1 : 0),
    },
    state: {
      lastStatus: status,
      lastConsecutive: m && m.state.lastStatus === status ? m.state.lastConsecutive + 1 : 1,
      lastResponseMs: avgResponseMs,
      lastRunAt: Math.floor(Date.now() / 1000),
    },
    percentiles: m?.percentiles ?? null,
    projectCount: m?.projectCount,
    serviceCount: m?.serviceCount,
  };
}

/** Text color class for a probe status value (`success`/`timeout`/`failure`/`skipped`). */
export function statusTextClass(status: string | null | undefined): string {
  if (!status) return 'text-text-primary';
  if (status === 'success') return 'text-status-success';
  if (status === 'timeout') return 'text-status-warning';
  if (status === 'skipped') return 'text-text-secondary';
  return 'text-status-failure';
}

/**
 * Dot background class for a probe status value (`skipped` falls through to
 * neutral). `error` — a run that could not be evaluated — shares the failure
 * colour rather than the neutral one: it is not a healthy check, and the text
 * class above already treats it that way.
 */
export function statusDotClass(status: string | null | undefined): string {
  if (status === 'success') return 'bg-status-success';
  if (status === 'timeout') return 'bg-status-warning';
  if (status === 'failure' || status === 'error') return 'bg-status-failure';
  return 'bg-text-secondary';
}

export interface MetricsCounters {
  probesTotal: number;
  probesSuccess: number;
  probesFailure: number;
  probesTimeout: number;
}

export interface MetricsState {
  lastStatus: string | null;
  lastConsecutive: number;
  lastResponseMs: number;
  lastRunAt: number | null;
}

export interface ResponsePercentiles {
  p50: number;
  p95: number;
  p99: number;
}

export interface ServiceMetricsDto {
  counters: MetricsCounters;
  state: MetricsState;
  percentiles: ResponsePercentiles | null;
  /** Accessible-set totals — present only on aggregate (workspace/project) responses. */
  projectCount?: number | null;
  serviceCount?: number | null;
}

/**
 * Server-aggregated probe roll-up delta (`metrics.delta` realtime events):
 * counts observed since the last flush interval.
 */
export interface MetricsDelta {
  total: number;
  success: number;
  failure: number;
  timeout: number;
  /** Runs that did not evaluate (agent or executor fault). Absent from older servers. */
  error?: number;
  sumMs: number;
  callCount: number;
}

/** One hour of aggregated probe activity (`hour` format: `yyyyMMddHH`). */
export interface HourlyBucket {
  hour: string;
  total: number;
  success: number;
  failure: number;
  timeout: number;
  sumMs: number;
  callCount: number;
}

/** One `probe_aggregates` bucket, as a statistics time-series point. */
export interface StatBucket {
  /** ISO-8601 bucket start (UTC). */
  bucketStart: string;
  p50Ms: number | null;
  p95Ms: number | null;
  p99Ms: number | null;
  /** Percentage 0..100; null when the bucket had no runs. */
  uptimePct: number | null;
  errorRatePct: number | null;
  probeCount: number;
}

/** Per-region (per probe agent) statistics series. */
export interface RegionSeries {
  agentId: number;
  agentLabel: string;
  buckets: StatBucket[];
}

/** Average time spent in each connection phase, in milliseconds (rounded). */
export interface EndpointPhases {
  dnsMs: number;
  connectMs: number;
  tlsMs: number;
  ttfbMs: number;
  transferMs: number;
  responseMs: number;
}

/** How many calls to one endpoint answered with one status code (`0` = no response at all). */
export interface EndpointCodeCount {
  code: number;
  count: number;
}

/**
 * One endpoint of a service over the selected window. An endpoint is a method
 * plus the URL *template* as the script writes it — interpolations stay as
 * placeholders (`GET {p.baseUrl}/orders/{orderId}`), so a key never carries a
 * variable's value and never moves when a base URL changes.
 */
export interface EndpointStat {
  /** `"<METHOD> <template>"` — unique per service. */
  key: string;
  method: string;
  template: string;
  /** Latest resolved URL for this endpoint, query stripped; null when unknown. */
  exampleUrl: string | null;
  calls: number;
  /** Sorted by code ascending, `0` last. */
  codes: EndpointCodeCount[];
  /** Window averages over the calls that carried timings; null when none did. */
  phases: EndpointPhases | null;
  /** The same averages over the window of equal length before this one; null when it holds no data. */
  previousPhases: EndpointPhases | null;
  avgSizeBytes: number | null;
}

/**
 * One bucket of one endpoint's series. Sparse: a bucket in which the endpoint
 * was not called has no point at all, which is not the same as a zero.
 */
export interface EndpointSeriesPoint {
  bucketStart: string;
  calls: number;
  /** Bucket averages over the calls that carried timings; null when none did. */
  phases: EndpointPhases | null;
  /** Bucket average over the calls that reported a size; null when none did. */
  avgSizeBytes: number | null;
}

/** One endpoint's points across the window, ascending by bucket start. */
export interface EndpointSeries {
  key: string;
  method: string;
  template: string;
  points: EndpointSeriesPoint[];
}

/**
 * Per-endpoint series over the window (`…/metrics/statistics/endpoint-series`).
 * A sub-resource of its own: it is two orders of magnitude bigger than the
 * statistics read, which the tab polls.
 */
export interface ServiceEndpointSeries {
  window: string;
  /** "hourly" | "daily" — the same mapping the statistics read uses. */
  bucketType: string;
  /** Ascending union of every bucket start in the response — the shared x axis. */
  buckets: string[];
  /**
   * The whole service, including endpoints the cap dropped — a bare series of
   * points, with no key, method or template of its own.
   */
  all: EndpointSeriesPoint[];
  endpoints: EndpointSeries[];
  endpointsTruncated: boolean;
}

/**
 * One assertion of one endpoint, identified by its *declared* side only — what
 * the target answered is never part of the identity.
 */
export interface AssertionStat {
  endpointKey: string;
  method: string;
  template: string;
  /** `expect` | `check` | `assert`, verbatim — anything else passes through. */
  assertionMethod: string;
  /** Scope assertions (`.expect()` / `.check()`); null for an `assert` condition. */
  scope: string | null;
  op: string | null;
  expected: string | null;
  /** `assert` conditions; null for a scope assertion. */
  kind: string | null;
  expression: string | null;
  failures: number;
  evaluations: number;
  failureRatePct: number;
  /** Never null — only assertions that failed are returned. */
  lastFailedAt: string;
}

/** Most-failing assertions over the window (`…/metrics/statistics/assertions`). */
export interface ServiceAssertionStats {
  window: string;
  /** Lower bound actually scanned — later than the window when the scan cap bit. */
  since: string;
  until: string;
  /** True when the scan stopped at its run cap, so `since` is not the window's start. */
  truncated: boolean;
  assertions: AssertionStat[];
}

/** One hour of one weekday, in UTC. Only cells with runs are returned. */
export interface FailureHeatmapCell {
  /** ISO-8601 weekday: 1 = Monday … 7 = Sunday. */
  weekday: number;
  /** 0..23, UTC. */
  hour: number;
  runs: number;
  failedRuns: number;
}

/** Failure rate by hour and weekday (`…/metrics/statistics/failure-heatmap`). */
export interface ServiceFailureHeatmap {
  days: number;
  /** Always "UTC" — the grid is extracted in UTC and labelled as such. */
  timezone: string;
  since: string;
  until: string;
  /** Oldest / newest hour that carried runs; null for a service with no history. */
  coveredFrom: string | null;
  coveredTo: string | null;
  totalRuns: number;
  totalFailedRuns: number;
  cells: FailureHeatmapCell[];
}

/** Deep service statistics from `probe_aggregates`: overall trend + per-region breakdown. */
export interface ServiceStatistics {
  window: string;
  /** "hourly" | "daily". */
  bucketType: string;
  overall: StatBucket[];
  regions: RegionSeries[];
  /**
   * Per-endpoint breakdown. Optional on the wire: a backend that predates it
   * sends neither field, and the statistics tab then renders exactly as before.
   */
  endpoints?: EndpointStat[];
  /** True when the service has more endpoints than the response carries. */
  endpointsTruncated?: boolean;
}

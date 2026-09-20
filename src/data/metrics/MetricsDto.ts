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

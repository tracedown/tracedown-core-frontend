import type { ServiceMetricsDto } from '@/data/metrics/MetricsDto';

export interface FailedAssertion {
  scope: string;
  expected: string | null;
  actual: string | null;
}

export interface LastFailureInfo {
  assertions: FailedAssertion[];
}

/** One probe run in the recent-history chart. */
export interface ProbePoint {
  status: string;
  avgResponseMs: number;
  callCount: number;
  failedCalls: number;
  timestamp: number;
}

export interface ServiceSummary {
  id: string;
  projectId: string;
  name: string;
  label: string | null;
  script: string;
  schedule: string;
  probeMode: string;
  queuePolicy: string;
  serviceWindow: string | null;
  /** When false, runs are dispatched with body saving off — no stored body to inspect. */
  saveResponseBodies: boolean;
  isActive: boolean;
  lastStatus: string | null;
  lastStatusSince: string | null;
  version: number;
  createdAt: string;
  metrics: ServiceMetricsDto | null;
  lastFailure: LastFailureInfo | null;
}

export interface CreateServiceRequest {
  projectId: string;
  name: string;
  label?: string;
  schedule?: string;
  saveResponseBodies?: boolean;
}

/** PATCH /services/{id} — any subset of the editable config fields. */
export interface UpdateServiceConfigRequest {
  name?: string;
  label?: string;
  schedule?: string;
  probeMode?: string;
  queuePolicy?: string;
  /** Maintenance-window RRULE; an empty string clears the window. */
  serviceWindow?: string;
  saveResponseBodies?: boolean;
}

export interface UpdateServiceScriptRequest {
  script: string;
  version: number;
}

export interface ToggleServiceRequest {
  isActive: boolean;
}

/** One service a scoped toggle did not act on, and why. */
export interface SkippedService {
  serviceId: string;
  name: string;
  /** `forbidden`, `script_missing` or `script_invalid`. */
  reason: string;
}

/** Outcome of enabling or disabling every service in a project or workspace. */
export interface ScopedToggleResult {
  /** Services the scope covered, before any were filtered out. */
  matched: number;
  /** Services whose `isActive` actually moved. */
  changed: number;
  /** Already in the requested state, so left untouched. */
  unchanged: number;
  /** A capped sample of those covered but not acted on — see `skippedTotal`. */
  skipped: SkippedService[];
  /** How many were skipped in total; exceeds `skipped.length` once capped. */
  skippedTotal: number;
  /** Skip count per reason, over all skips rather than the capped sample. */
  skippedByReason: Record<string, number>;
}

/** Combined detail + recent probe points, served by /services/{id}/snapshot. */
export interface ServiceSnapshot {
  service: ServiceSummary;
  recentProbes: ProbePoint[];
}

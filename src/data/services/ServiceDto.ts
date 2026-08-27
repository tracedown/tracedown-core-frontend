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

/** The editable config fields — any subset; omitted means unchanged. */
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

/**
 * PATCH /services/{id} — one save: changed config fields, the script when it
 * changed, and the version the editor loaded.
 *
 * Config and script go in the same request because the backend applies them in
 * one transaction. Sent as two, a save that lost a race committed the config
 * and only then learned the script was stale, leaving the service wearing one
 * editor's schedule and another's script.
 */
export interface UpdateServiceRequest extends UpdateServiceConfigRequest {
  /** Omitted when the script is unchanged. */
  script?: string;
  /** The version this edit was based on; a mismatch is rejected with 409. */
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

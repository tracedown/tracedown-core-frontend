export interface ProbeResultSummary {
  id: string;
  status: string;
  runDurationMs: number;
  totalResponseMs: number;
  startedAt: string;
  agentSlug: string | null;
}

export interface ProbeStepSummary {
  id: string;
  stepNum: number;
  requestUrl: string;
  statusCode: number | null;
  responseTimeMs: number | null;
  dnsMs: number | null;
  connectMs: number | null;
  tlsMs: number | null;
  ttfbMs: number | null;
  transferMs: number | null;
  responseSizeBytes: number | null;
  assertionResults: unknown;
  headers: unknown;
  hasBody: boolean;
  bodyNotStoredReason: string | null;
  error: string | null;
}

export interface ProbeResultDetail {
  id: string;
  serviceId: string;
  status: string;
  runDurationMs: number;
  startedAt: string;
  /** Null for skipped probes — they never reached an agent. */
  probeAgentId: number | null;
  rawResult: Record<string, unknown>;
  steps: ProbeStepSummary[];
}

/** A step assertion normalized from the raw `assertionResults` payload. */
export interface ParsedAssertion {
  scope: string;
  op: string;
  expected: string;
  actual: string;
  outcome: string;
}

/** Response of GET .../steps/{stepId}/body — exactly one field is set.
 * `url` is a short-lived presigned object-storage URL the client fetches
 * directly (not a redirect: the browser must send the page's real origin so
 * an origin-scoped bucket CORS policy can match). */
export interface StepBodyResponse {
  content?: string | null;
  url?: string | null;
}

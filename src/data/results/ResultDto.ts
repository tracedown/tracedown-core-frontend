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

/**
 * A step assertion normalized from the raw `assertionResults` payload (spec
 * §9.2). A scope assertion (`.expect()`/`.check()`) names a scope and compares
 * it; an `.assert()` condition is an expression with its two resolved operands.
 * Values are display text: JSON, so `"404"` and `404` stay apart.
 */
export type ParsedAssertion =
  | {
    type: 'scope';
    /** `expect` | `check`. */
    method: string;
    /** `passed` | `failed` | `indeterminate`, verbatim. */
    outcome: string;
    scope: string;
    op: string;
    expected: string;
    actual: string;
  }
  | {
    type: 'condition';
    /** `expect` | `check` — whether a failure is hard or soft. */
    kind: string;
    /** `passed` | `failed` | `indeterminate`, verbatim. */
    outcome: string;
    expression: string;
    actualLhs: string;
    actualRhs: string;
  };

/** Response of GET .../steps/{stepId}/body — exactly one field is set.
 * `url` is a short-lived presigned object-storage URL the client fetches
 * directly (not a redirect: the browser must send the page's real origin so
 * an origin-scoped bucket CORS policy can match). */
export interface StepBodyResponse {
  content?: string | null;
  url?: string | null;
  /** Media type as the store reported it, when it knew one. */
  contentType?: string | null;
  /**
   * `base64` when `content` carries bytes rather than text — a binary body is
   * never mangled into UTF-8 on the way here. Absent or null means text.
   */
  encoding?: 'base64' | null;
}

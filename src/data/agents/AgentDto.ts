export interface AgentStatus {
  agentSlug: string;
  status: string;
  lastCheck: string | null;
  lastResponseMs: number | null;
}

export interface AgentHealthResponse {
  statuses: AgentStatus[];
}

export type EffectiveHealth = 'healthy' | 'unhealthy' | 'down' | 'unknown';

// The challenge is not a ping: a cold mTLS handshake plus a Lace script that
// fetches a token from the gateway (scheduler->agent->gateway->redis), so the
// healthy budget must absorb ~5 round trips plus script startup — for an
// agent on another continent that is legitimately ~1-1.2s. Matches the
// backend's DEGRADED_RTT_MS.
const UNHEALTHY_THRESHOLD_MS = 1200;

/** Derives display health from the raw status plus the last response time. */
export function effectiveHealth(agent: AgentStatus): EffectiveHealth {
  if (agent.status === 'success') {
    if (agent.lastResponseMs != null && agent.lastResponseMs > UNHEALTHY_THRESHOLD_MS) return 'unhealthy';
    return 'healthy';
  }
  if (agent.status === 'failure' || agent.status === 'timeout') return 'down';
  return 'unknown';
}

/** One registered agent from GET /agents/list. */
export interface AgentSummary {
  slug: string;
  label: string;
  agentUri: string;
  isActive: boolean;
  lastStatus: string;
  lastPing: string | null;
  lastPongDeltaMs: number | null;
  /** Operator setting: seal dispatches to this agent's certificate on top of mTLS. */
  encryptPayload: boolean;
  /** Read-only — what the agent reported at its last health challenge. */
  supportsEncryptedPayload: boolean;
  createdAt: string;
}

/** Request of POST /agents/bootstrap-token. */
export interface CreateBootstrapTokenRequest {
  slug: string;
  label?: string;
}

/** Response — the raw token appears exactly once, here. */
export interface BootstrapTokenResponse {
  slug: string;
  token: string;
  expiresAt: string;
}

/** Health mapping for a full agent row (same rules as the status feed). */
export function agentEffectiveHealth(agent: AgentSummary): EffectiveHealth {
  return effectiveHealth({
    agentSlug: agent.slug,
    status: agent.lastStatus,
    lastCheck: agent.lastPing,
    lastResponseMs: agent.lastPongDeltaMs,
  });
}

/** One health-challenge outcome from GET /agents/{slug}/checks. */
export interface AgentHealthCheck {
  challengedAt: string;
  respondedAt: string | null;
  roundTripMs: number | null;
  result: string;
}

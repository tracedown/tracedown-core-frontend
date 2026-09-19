import type { BodyStoreSummary } from '@/data/bodyStores/BodyStoreDto';

export interface AgentStatus {
  agentSlug: string;
  status: string;
  lastCheck: string | null;
  lastResponseMs: number | null;
  /** The backend's own slowness verdict; absent from a backend older than it. */
  degraded?: boolean;
  /** The agent's usual round trip, null until it has enough rounds to say. */
  baselineMs?: number | null;
  /** What `degraded` was measured against. */
  degradedThresholdMs?: number;
}

export interface AgentHealthResponse {
  statuses: AgentStatus[];
}

export type EffectiveHealth = 'healthy' | 'unhealthy' | 'down' | 'unknown';

// Only used against a backend too old to send `degraded`. It is the backend's
// floor, not its rule: the real verdict is the larger of that floor and twice
// the agent's own recent median, so this alone calls every agent on another
// continent degraded forever.
const UNHEALTHY_THRESHOLD_MS = 1200;

/**
 * Derives display health from the raw status plus the backend's verdict.
 *
 * The backend decides what slow means for each agent — a fixed ceiling here
 * cannot, because the round trip's floor is set by how far away the agent is.
 */
export function effectiveHealth(agent: AgentStatus): EffectiveHealth {
  if (agent.status === 'success') {
    if (typeof agent.degraded === 'boolean') return agent.degraded ? 'unhealthy' : 'healthy';
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
  /** Body store the agent writes response bodies to; null = the default store. */
  bodyStoreId: string | null;
  createdAt: string;
  /** The backend's own slowness verdict; absent from a backend older than it. */
  degraded?: boolean;
  /** The agent's usual round trip, null until it has enough rounds to say. */
  baselineMs?: number | null;
  /** What `degraded` was measured against. */
  degradedThresholdMs?: number;
}

/** Request of POST /agents/bootstrap-token. */
export interface CreateBootstrapTokenRequest {
  slug: string;
  label?: string;
  /** Body store the agent is enrolled onto; omitted = the default store. */
  bodyStoreId?: string;
}

/** Response — the raw token appears exactly once, here. */
export interface BootstrapTokenResponse {
  slug: string;
  token: string;
  expiresAt: string;
  /** Base URL the agent enrols against; null when the gateway has none configured. */
  schedulerUrl?: string | null;
  /** The store the agent is enrolled onto, so its storage settings can be printed; null = default. */
  bodyStore?: BodyStoreSummary | null;
}

/** Health mapping for a full agent row (same rules as the status feed). */
export function agentEffectiveHealth(agent: AgentSummary): EffectiveHealth {
  return effectiveHealth(agentStatusOf(agent));
}

/** An admin fleet row read as a status-feed entry — the same fields under other names. */
export function agentStatusOf(agent: AgentSummary): AgentStatus {
  return {
    agentSlug: agent.slug,
    status: agent.lastStatus,
    lastCheck: agent.lastPing,
    lastResponseMs: agent.lastPongDeltaMs,
    degraded: agent.degraded,
    baselineMs: agent.baselineMs,
    degradedThresholdMs: agent.degradedThresholdMs,
  };
}

/** One health-challenge outcome from GET /agents/{slug}/checks. */
export interface AgentHealthCheck {
  challengedAt: string;
  respondedAt: string | null;
  roundTripMs: number | null;
  result: string;
}

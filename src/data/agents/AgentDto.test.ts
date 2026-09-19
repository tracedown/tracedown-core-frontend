import { describe, expect, it } from 'vitest';
import { effectiveHealth, type AgentStatus } from '@/data/agents/AgentDto';

/**
 * Health is the backend's verdict, not a number compared here.
 *
 * The round trip is a cold mTLS handshake plus the agent's callback to the
 * gateway, so its floor is set by geography: an agent on another continent
 * sits near a second and a half every round without anything being wrong. A
 * fixed ceiling in the dashboard called every one of those degraded, for ever,
 * while the backend — which measures each agent against its own recent median
 * — had never convicted them. So `degraded` decides whenever it is sent.
 */
function agent(over: Partial<AgentStatus> = {}): AgentStatus {
  return {
    agentSlug: 'ap-southeast',
    status: 'success',
    lastCheck: '2026-09-19T10:00:00Z',
    lastResponseMs: 1800,
    ...over,
  };
}

describe('effectiveHealth', () => {
  it('trusts the backend over the round trip when it says the agent is fine', () => {
    expect(effectiveHealth(agent({ degraded: false, lastResponseMs: 1800 }))).toBe('healthy');
  });

  it('trusts the backend when it says the agent is degraded', () => {
    expect(effectiveHealth(agent({ degraded: true, lastResponseMs: 1800 }))).toBe('unhealthy');
  });

  it('trusts the backend even when the round trip looks unremarkable', () => {
    expect(effectiveHealth(agent({ degraded: true, lastResponseMs: 90 }))).toBe('unhealthy');
  });

  it('falls back to the fixed threshold only when the verdict is absent', () => {
    expect(effectiveHealth(agent({ lastResponseMs: 1800 }))).toBe('unhealthy');
    expect(effectiveHealth(agent({ lastResponseMs: 900 }))).toBe('healthy');
  });

  it('reads a failed status as down whatever the verdict says', () => {
    expect(effectiveHealth(agent({ status: 'failure', degraded: false }))).toBe('down');
    expect(effectiveHealth(agent({ status: 'timeout' }))).toBe('down');
  });

  it('has nothing to say about a status it does not know', () => {
    expect(effectiveHealth(agent({ status: 'pending' }))).toBe('unknown');
  });
});

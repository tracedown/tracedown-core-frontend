import { useI18n } from 'vue-i18n';
import type { AgentStatus } from '@/data/agents/AgentDto';

/**
 * The two things an agent's round trip needs said about it: what it was, and
 * what the backend makes of it.
 *
 * A round trip alone means nothing without the agent's own pace — a second and
 * a half is ordinary for one on another continent and alarming for one next
 * door — so the figure is shown beside the agent's typical one, and the
 * backend's `degraded` verdict beside the ceiling it was reached from. Shared
 * by the status feed and the fleet list so the two cannot drift apart.
 */
export function useAgentHealthText() {
  const { t } = useI18n();

  const ms = (value: number): string => t('agents.roundTripText.ms', { ms: value.toLocaleString() });

  /** "1,650 ms", or "1,650 ms · typical 1,500 ms" once the agent has a baseline. */
  function roundTripLabel(agent: AgentStatus): string {
    if (agent.lastResponseMs == null) return '';
    const last = ms(agent.lastResponseMs);
    if (agent.baselineMs == null) return last;
    return t('agents.roundTripText.withBaseline', { last, typical: ms(agent.baselineMs) });
  }

  /** What the agent is called degraded against; empty when it is not degraded. */
  function degradedReason(agent: AgentStatus): string | undefined {
    if (!agent.degraded || agent.degradedThresholdMs == null) return undefined;
    return t('agents.roundTripText.degradedReason', { threshold: ms(agent.degradedThresholdMs) });
  }

  return { roundTripLabel, degradedReason };
}

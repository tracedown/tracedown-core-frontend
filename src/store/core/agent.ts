import { ref } from 'vue';
import { defineStore } from 'pinia';
import { http } from '@/config/requests';
import type {
  AgentHealthCheck, AgentStatus, AgentSummary, BootstrapTokenResponse, CreateBootstrapTokenRequest,
} from '@/data/agents/AgentDto';
import type { ActionDataResult, ActionResult } from '@/types/actions';

/** Probe-agent fleet: registered agents + bootstrap-token generation. */
export const useAgentStore = defineStore('agent', () => {
  const agents = ref<AgentSummary[]>([]);
  const loading = ref<boolean>(false);

  async function fetchAgents(): Promise<ActionResult> {
    loading.value = true;
    try {
      const res = await http.get<AgentSummary[]>('/agents/list');
      if (!res.success || !res.data) {
        return { ok: false, message: res.errorInfo?.message };
      }
      agents.value = res.data;
      return { ok: true };
    } finally {
      loading.value = false;
    }
  }

  async function createBootstrapToken(
    request: CreateBootstrapTokenRequest,
  ): Promise<ActionDataResult<BootstrapTokenResponse>> {
    const res = await http.post<BootstrapTokenResponse, CreateBootstrapTokenRequest>('/agents/bootstrap-token', request);
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    return { ok: true, data: res.data };
  }

  async function setActive(slug: string, isActive: boolean): Promise<ActionResult> {
    const res = await http.patch<{ ok: boolean }, { isActive: boolean }>(`/agents/${slug}`, { isActive });
    if (!res.success) {
      return { ok: false, message: res.errorInfo?.message };
    }
    agents.value = agents.value.map(a => (a.slug === slug ? { ...a, isActive } : a));
    return { ok: true };
  }

  /**
   * Seals dispatches to this agent on top of mTLS. Only meaningful for an agent
   * whose `supportsEncryptedPayload` is true — the UI gates on that.
   */
  async function setEncryptPayload(slug: string, encryptPayload: boolean): Promise<ActionResult> {
    const res = await http.patch<{ ok: boolean }, { encryptPayload: boolean }>(`/agents/${slug}`, { encryptPayload });
    if (!res.success) {
      return { ok: false, message: res.errorInfo?.message };
    }
    agents.value = agents.value.map(a => (a.slug === slug ? { ...a, encryptPayload } : a));
    return { ok: true };
  }

  /** Health-check history for one agent over the trailing window. */
  async function fetchChecks(slug: string, hours: number): Promise<ActionDataResult<AgentHealthCheck[]>> {
    const res = await http.get<AgentHealthCheck[]>(`/agents/${slug}/checks?hours=${hours}`, { disableLoading: true });
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    return { ok: true, data: res.data };
  }

  /** Decommissions an agent (history rows survive server-side). */
  async function deleteAgent(slug: string): Promise<ActionResult> {
    const res = await http.delete<{ ok: boolean }>(`/agents/${slug}`);
    if (!res.success) {
      return { ok: false, message: res.errorInfo?.message };
    }
    agents.value = agents.value.filter(a => a.slug !== slug);
    return { ok: true };
  }

  /** Patches live health-feed data into the loaded rows (matched by slug). */
  function applyHealth(statuses: AgentStatus[]) {
    const bySlug = new Map(statuses.map(s => [s.agentSlug, s]));
    agents.value = agents.value.map((agent) => {
      const status = bySlug.get(agent.slug);
      if (!status) return agent;
      return {
        ...agent,
        lastStatus: status.status,
        lastPing: status.lastCheck,
        lastPongDeltaMs: status.lastResponseMs,
      };
    });
  }

  return {
    agents, loading, fetchAgents, fetchChecks, createBootstrapToken,
    setActive, setEncryptPayload, deleteAgent, applyHealth,
  };
});

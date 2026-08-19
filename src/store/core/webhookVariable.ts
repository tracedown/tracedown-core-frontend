import { reactive } from 'vue';
import { defineStore } from 'pinia';
import { http } from '@/config/requests';
import type {
  CreateVariableRequest,
  UpdateVariableRequest,
  VariableSummary,
} from '@/data/variables/VariableDto';
import type { ActionResult } from '@/types/actions';

/**
 * Per-webhook variables (`/api/v1/webhooks/{id}/variables`), referenced as
 * `$h.name` in a webhook's URL and config values. Gated by the `webhooks`
 * permission. Resolved only at delivery — probe scripts can never read them,
 * which is the point: a delivery credential doesn't have to be an org-wide
 * variable. State is keyed by webhook since several panels may be mounted.
 */
export const useWebhookVariableStore = defineStore('webhookVariable', () => {
  const variablesByWebhook = reactive(new Map<string, VariableSummary[]>());
  const revealedValues = reactive(new Map<string, string>());

  const base = (webhookId: string) => `/webhooks/${webhookId}/variables`;

  async function fetchVariables(webhookId: string): Promise<ActionResult> {
    const res = await http.get<VariableSummary[]>(base(webhookId), { disableLoading: true });
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    variablesByWebhook.set(webhookId, res.data);
    return { ok: true };
  }

  async function createVariable(webhookId: string, request: CreateVariableRequest): Promise<ActionResult> {
    const res = await http.post<VariableSummary, CreateVariableRequest>(base(webhookId), request);
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    return fetchVariables(webhookId);
  }

  async function updateVariable(webhookId: string, variableId: string, value: string): Promise<ActionResult> {
    const res = await http.patch<VariableSummary, UpdateVariableRequest>(`${base(webhookId)}/${variableId}`, { value });
    if (!res.success) {
      return { ok: false, message: res.errorInfo?.message };
    }
    revealedValues.delete(variableId);
    return fetchVariables(webhookId);
  }

  async function deleteVariable(webhookId: string, variableId: string): Promise<ActionResult> {
    const res = await http.delete(`${base(webhookId)}/${variableId}`);
    if (!res.success) {
      return { ok: false, message: res.errorInfo?.message };
    }
    revealedValues.delete(variableId);
    return fetchVariables(webhookId);
  }

  async function revealVariable(webhookId: string, variableId: string): Promise<ActionResult> {
    // Reveal is a plain GET on the item, like org variables.
    const res = await http.get<VariableSummary>(`${base(webhookId)}/${variableId}`);
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    revealedValues.set(variableId, res.data.value);
    return { ok: true };
  }

  function hideValue(variableId: string) {
    revealedValues.delete(variableId);
  }

  function clear() {
    variablesByWebhook.clear();
    revealedValues.clear();
  }

  return {
    variablesByWebhook, revealedValues,
    fetchVariables, createVariable, updateVariable, deleteVariable,
    revealVariable, hideValue, clear,
  };
});

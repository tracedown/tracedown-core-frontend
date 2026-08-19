import { ref } from 'vue';
import { defineStore } from 'pinia';
import { http } from '@/config/requests';
import type {
  CreateWebhookRequest, UpdateWebhookRequest, WebhookBindingSummary, WebhookSummary,
} from '@/data/webhooks/WebhookDto';
import type { ActionDataResult, ActionResult } from '@/types/actions';
import type { Page } from '@/types/pfs';

/** Org webhook delivery channels (bindings are managed per resource). */
export const useWebhookStore = defineStore('webhook', () => {
  const webhooks = ref<WebhookSummary[]>([]);
  const loading = ref<boolean>(false);

  async function fetchWebhooks(): Promise<ActionResult> {
    loading.value = true;
    try {
      const res = await http.get<Page<WebhookSummary>>('/webhooks?pageSize=100');
      if (!res.success || !res.data) {
        return { ok: false, message: res.errorInfo?.message };
      }
      webhooks.value = res.data.items;
      return { ok: true };
    } finally {
      loading.value = false;
    }
  }

  async function createWebhook(request: CreateWebhookRequest): Promise<ActionDataResult<WebhookSummary>> {
    const res = await http.post<WebhookSummary, CreateWebhookRequest>('/webhooks', request);
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    webhooks.value = [...webhooks.value, res.data];
    return { ok: true, data: res.data };
  }

  async function updateWebhook(id: string, request: UpdateWebhookRequest): Promise<ActionResult> {
    const res = await http.patch<WebhookSummary, UpdateWebhookRequest>(`/webhooks/${id}`, request);
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    const updated = res.data;
    webhooks.value = webhooks.value.map(w => (w.id === id ? updated : w));
    return { ok: true };
  }

  async function deleteWebhook(id: string): Promise<ActionResult> {
    const res = await http.delete<{ ok: boolean }>(`/webhooks/${id}`);
    if (!res.success) {
      return { ok: false, message: res.errorInfo?.message };
    }
    webhooks.value = webhooks.value.filter(w => w.id !== id);
    return { ok: true };
  }

  // ── Resource bindings (list state lives with the consuming section) ──

  async function fetchBindings(resourceType: string, resourceId: string,): Promise<ActionDataResult<WebhookBindingSummary[]>> {
    const res = await http.get<Page<WebhookBindingSummary>>(`/webhooks/bindings/${resourceType}/${resourceId}?pageSize=100`, { disableLoading: true });
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    return { ok: true, data: res.data.items };
  }

  async function createBinding(resourceType: string, resourceId: string, webhookId: string,): Promise<ActionDataResult<WebhookBindingSummary>> {
    const res = await http.post<WebhookBindingSummary, { webhookId: string }>(`/webhooks/bindings/${resourceType}/${resourceId}`, { webhookId });
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    return { ok: true, data: res.data };
  }

  async function setBindingEnabled(bindingId: string, enabled: boolean): Promise<ActionResult> {
    const res = await http.patch<WebhookBindingSummary, { enabled: boolean }>(`/webhooks/bindings/${bindingId}`, { enabled });
    if (!res.success) {
      return { ok: false, message: res.errorInfo?.message };
    }
    return { ok: true };
  }

  async function deleteBinding(bindingId: string): Promise<ActionResult> {
    const res = await http.delete<{ ok: boolean }>(`/webhooks/bindings/${bindingId}`);
    if (!res.success) {
      return { ok: false, message: res.errorInfo?.message };
    }
    return { ok: true };
  }

  return {
    webhooks, loading, fetchWebhooks, createWebhook, updateWebhook, deleteWebhook,
    fetchBindings, createBinding, setBindingEnabled, deleteBinding,
  };
});

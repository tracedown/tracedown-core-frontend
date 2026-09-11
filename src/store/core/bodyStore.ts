import { ref } from 'vue';
import { defineStore } from 'pinia';
import { http } from '@/config/requests';
import type {
  BodyStoreRequest, BodyStoreSaveResult, BodyStoreSummary, BodyStoreTestResult, DefaultBodyStore,
} from '@/data/bodyStores/BodyStoreDto';
import type { ActionDataResult, ActionResult } from '@/types/actions';
import type { ErrorInfo } from '@/requests';
import type { ErrorCode } from '@/config/errors';

/** Why a save failed, with the missing field when the backend named one. */
function saveFailure(error: ErrorInfo<ErrorCode> | undefined): BodyStoreSaveResult {
  const field = error?.details?.field;
  return {
    ok: false,
    message: error?.message,
    code: error?.code,
    field: typeof field === 'string' ? field : undefined,
  };
}

/**
 * Body stores: where agents write response bodies, beside the
 * environment-configured default store (which is not a row and is only
 * described here, read-only).
 */
export const useBodyStoreStore = defineStore('bodyStore', () => {
  const stores = ref<BodyStoreSummary[]>([]);
  const defaultStore = ref<DefaultBodyStore | null>(null);
  const loading = ref<boolean>(false);

  async function fetchStores(): Promise<ActionResult> {
    loading.value = true;
    try {
      const res = await http.get<BodyStoreSummary[]>('/body-stores');
      if (!res.success || !res.data) return { ok: false, message: res.errorInfo?.message };
      stores.value = res.data;
      return { ok: true };
    } finally {
      loading.value = false;
    }
  }

  async function fetchDefault(): Promise<ActionResult> {
    const res = await http.get<DefaultBodyStore>('/body-stores/default', { disableLoading: true });
    if (!res.success || !res.data) return { ok: false, message: res.errorInfo?.message };
    defaultStore.value = res.data;
    return { ok: true };
  }

  async function createStore(request: BodyStoreRequest): Promise<BodyStoreSaveResult> {
    const res = await http.post<BodyStoreSummary, BodyStoreRequest>('/body-stores', request);
    if (!res.success || !res.data) return saveFailure(res.errorInfo);
    stores.value = [...stores.value, res.data];
    return { ok: true, data: res.data };
  }

  async function updateStore(id: string, request: BodyStoreRequest): Promise<BodyStoreSaveResult> {
    const res = await http.put<BodyStoreSummary, BodyStoreRequest>(`/body-stores/${id}`, request);
    if (!res.success) return saveFailure(res.errorInfo);
    // The response body is the updated row when the backend returns one;
    // otherwise re-read the list rather than guess at derived fields.
    if (res.data && typeof res.data === 'object' && 'id' in res.data) {
      const updated = res.data;
      stores.value = stores.value.map(s => (s.id === id ? updated : s));
    } else {
      await fetchStores();
    }
    return { ok: true, data: stores.value.find(s => s.id === id) };
  }

  /** Refused with `body_store_in_use` while an agent, token or stored body references it. */
  async function deleteStore(id: string): Promise<ActionResult> {
    const res = await http.delete<{ ok: boolean }>(`/body-stores/${id}`);
    if (!res.success) return { ok: false, message: res.errorInfo?.message, code: res.errorInfo?.code };
    stores.value = stores.value.filter(s => s.id !== id);
    return { ok: true };
  }

  /** Read-only reachability probe. A failed probe is data (`ok: false`), not an action failure. */
  async function testStore(id: string): Promise<ActionDataResult<BodyStoreTestResult>> {
    const res = await http.post<BodyStoreTestResult>(`/body-stores/${id}/test`, undefined, { disableLoading: true });
    if (!res.success || !res.data) return { ok: false, message: res.errorInfo?.message };
    return { ok: true, data: res.data };
  }

  /** Keeps the per-store agent counts right after an assignment changes. */
  function moveAgent(from: string | null, to: string | null) {
    if (from === to) return;
    stores.value = stores.value.map((s) => {
      if (s.id === from) return { ...s, agents: Math.max(0, s.agents - 1) };
      if (s.id === to) return { ...s, agents: s.agents + 1 };
      return s;
    });
  }

  return {
    stores, defaultStore, loading,
    fetchStores, fetchDefault, createStore, updateStore, deleteStore, testStore, moveAgent,
  };
});

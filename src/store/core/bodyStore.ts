import { ref } from 'vue';
import { defineStore } from 'pinia';
import { http } from '@/config/requests';
import { bodyStoreUsage } from '@/data/bodyStores/BodyStoreDto';
import type {
  BodyStoreRequest, BodyStoreSaveResult, BodyStoreTestResult, BodyStoreUsage, BodyStoreView,
  DefaultBodyStore,
} from '@/data/bodyStores/BodyStoreDto';
import type { ActionDataResult, ActionResult } from '@/types/actions';
import type { ErrorInfo } from '@/requests';
import type { ErrorCode } from '@/config/errors';

/** A string field of the error details, or undefined when the backend named none. */
function detail(error: ErrorInfo<ErrorCode> | undefined, key: string): string | undefined {
  const value = error?.details?.[key];
  return typeof value === 'string' ? value : undefined;
}

/** Why a save failed, with the field the backend named and the reason it gave. */
function saveFailure(error: ErrorInfo<ErrorCode> | undefined): BodyStoreSaveResult {
  return {
    ok: false,
    message: error?.message,
    code: error?.code,
    field: detail(error, 'field'),
    reason: detail(error, 'reason'),
  };
}

/**
 * Body stores: where agents write response bodies, beside the
 * environment-configured default store (which is not a row and is only
 * described here, read-only).
 */
export const useBodyStoreStore = defineStore('bodyStore', () => {
  const stores = ref<BodyStoreView[]>([]);
  const defaultStore = ref<DefaultBodyStore | null>(null);
  /** The default store has been asked for, whatever the answer was. */
  const defaultLoaded = ref<boolean>(false);
  const defaultFailed = ref<boolean>(false);
  const loading = ref<boolean>(false);

  async function fetchStores(): Promise<ActionResult> {
    loading.value = true;
    try {
      const res = await http.get<BodyStoreView[]>('/body-stores');
      if (!res.success || !res.data) return { ok: false, message: res.errorInfo?.message };
      stores.value = res.data;
      return { ok: true };
    } finally {
      loading.value = false;
    }
  }

  async function fetchDefault(): Promise<ActionResult> {
    const res = await http.get<DefaultBodyStore>('/body-stores/default', { disableLoading: true });
    defaultLoaded.value = true;
    if (!res.success || !res.data) {
      defaultFailed.value = true;
      return { ok: false, message: res.errorInfo?.message };
    }
    defaultFailed.value = false;
    defaultStore.value = res.data;
    return { ok: true };
  }

  async function createStore(request: BodyStoreRequest): Promise<BodyStoreSaveResult> {
    const res = await http.post<BodyStoreView, BodyStoreRequest>('/body-stores', request);
    if (!res.success || !res.data) return saveFailure(res.errorInfo);
    stores.value = [...stores.value, res.data];
    return { ok: true, data: res.data };
  }

  async function updateStore(id: string, request: BodyStoreRequest): Promise<BodyStoreSaveResult> {
    const res = await http.put<BodyStoreView, BodyStoreRequest>(`/body-stores/${id}`, request);
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

  /**
   * Refused with `body_store_in_use` while an agent, an outstanding token or a
   * stored body references it — `data` then says which, so the caller can
   * offer the forgetting form. `forgetBodies` releases the stored bodies:
   * their URLs are cleared and they read as "the store was removed".
   */
  async function deleteStore(id: string, forgetBodies = false): Promise<ActionDataResult<BodyStoreUsage>> {
    const query = forgetBodies ? '?forgetBodies=true' : '';
    const res = await http.delete<{ ok: boolean }>(`/body-stores/${id}${query}`);
    if (!res.success) {
      return {
        ok: false,
        message: res.errorInfo?.message,
        code: res.errorInfo?.code,
        data: bodyStoreUsage(res.errorInfo?.details),
      };
    }
    stores.value = stores.value.filter(s => s.id !== id);
    return { ok: true };
  }

  /** Read-only reachability probe. A failed probe is data (`ok: false`), not an action failure. */
  async function testStore(id: string): Promise<ActionDataResult<BodyStoreTestResult>> {
    const res = await http.post<BodyStoreTestResult>(`/body-stores/${id}/test`, undefined, { disableLoading: true });
    if (!res.success || !res.data) return { ok: false, message: res.errorInfo?.message };
    // A probe that answers is also the freshest word on the store's health.
    if (res.data.ok) {
      stores.value = stores.value.map(s => (s.id === id ? { ...s, lastFailure: null } : s));
    } else if (res.data.error) {
      const failure = { code: res.data.error, at: new Date().toISOString() };
      stores.value = stores.value.map(s => (s.id === id ? { ...s, lastFailure: failure } : s));
    }
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
    stores, defaultStore, defaultLoaded, defaultFailed, loading,
    fetchStores, fetchDefault, createStore, updateStore, deleteStore, testStore, moveAgent,
  };
});

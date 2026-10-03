import { ref } from 'vue';
import { defineStore } from 'pinia';
import { http } from '@/config/requests';
import { DEFAULT_PAGE_SIZE, defaultPfsParams, pfsToQueryString } from '@/utils/pfs';
import { mintOutcomeUnknown, pageAfterRemoval } from '@/lib/apiKeys';
import type { ApiKeySummary, CreateApiKeyRequest } from '@/data/apikeys/ApiKeyDto';
import type { ActionDataResult, ActionResult } from '@/types/actions';
import type { Page, PfsFilter } from '@/types/pfs';

/** The most rows the API returns in one page, whatever page size is asked for. */
const MAX_PAGE_SIZE = 100;

/** A revoke or delete: done, refused, or found already gone (confirmed by the list). */
type KeyActionResult = ActionResult & { alreadyGone?: boolean };

type Surface = 'own' | 'org';

interface OrgKeyFilters {
  /** Only the keys acting as this user. */
  userId?: string;
  /** Only the keys whose display prefix contains this text. */
  prefix?: string;
}

/** Characters of a key the list shows, and so the most a prefix search can match. */
export const KEY_PREFIX_LENGTH = 11;

/**
 * API keys, on their two surfaces:
 *  - the user's own keys, across every organization (`/me/api-keys`): mint,
 *    revoke, delete;
 *  - the organization's oversight of every key acting in it (`/api-keys`):
 *    revoke, delete — never mint, a key is only ever made by the user it acts as.
 *
 * The key itself comes back once, from minting, and is handed to the caller
 * only: no list this store keeps ever carries it.
 */
export const useApiKeyStore = defineStore('apiKey', () => {
  const ownKeys = ref<ApiKeySummary[]>([]);
  const ownTotal = ref<number>(0);
  const ownPage = ref<number>(1);
  const ownLoading = ref<boolean>(false);
  /** Why the last fetch of the list failed; null once one succeeds. Rows already shown stay. */
  const ownError = ref<string | null>(null);

  const orgKeys = ref<ApiKeySummary[]>([]);
  const orgTotal = ref<number>(0);
  const orgPage = ref<number>(1);
  const orgLoading = ref<boolean>(false);
  const orgError = ref<string | null>(null);
  let lastOrgFilters: OrgKeyFilters = {};

  // Per-list request counters: only the latest fetch of a list may write it,
  // so a slow answer to an earlier page or filter cannot overwrite a newer one.
  let ownSeq = 0;
  let orgSeq = 0;

  /** A list row: everything but the key. */
  function withoutKey(summary: ApiKeySummary): ApiKeySummary {
    const rest = { ...summary };
    delete rest.key;
    return rest;
  }

  // A key can sit in both lists at once (your own key, in the organization you
  // oversee), so a change made through either surface is applied to both.
  function markRevoked(keyId: string) {
    const revoke = (k: ApiKeySummary) => (k.id === keyId ? { ...k, revoked: true, state: 'revoked' as const } : k);
    ownKeys.value = ownKeys.value.map(revoke);
    orgKeys.value = orgKeys.value.map(revoke);
  }

  function forget(keyId: string) {
    if (ownKeys.value.some(k => k.id === keyId)) ownTotal.value = Math.max(0, ownTotal.value - 1);
    if (orgKeys.value.some(k => k.id === keyId)) orgTotal.value = Math.max(0, orgTotal.value - 1);
    ownKeys.value = ownKeys.value.filter(k => k.id !== keyId);
    orgKeys.value = orgKeys.value.filter(k => k.id !== keyId);
  }

  /**
   * Revoke and delete, on either surface, share their answer handling:
   *  - done: the row changes (or goes) in both lists; a delete refetches the
   *    page it was on, or the one before if that page emptied;
   *  - `not_found`: maybe deleted elsewhere — or a stale tab asking about a key
   *    its session cannot see. The list decides: refetched, and only if the key
   *    is no longer there is it reported as already gone;
   *  - a delete whose outcome is unknown refetches so the list shows the truth;
   *    any other refusal changes nothing.
   */
  async function act(surface: Surface, action: 'revoke' | 'delete', keyId: string): Promise<KeyActionResult> {
    const path = surface === 'own' ? `/me/api-keys/${keyId}` : `/api-keys/${keyId}`;
    const res = action === 'revoke'
      ? await http.post<{ ok: boolean }, Record<string, never>>(`${path}/revoke`, {})
      : await http.delete<{ ok: boolean }>(path);
    const list = surface === 'own' ? ownKeys : orgKeys;
    const total = surface === 'own' ? ownTotal : orgTotal;
    const page = surface === 'own' ? ownPage : orgPage;
    const refetch = (n: number) => (surface === 'own' ? fetchOwnKeys(n) : fetchOrgKeys(n));

    if (res.success) {
      if (action === 'revoke') {
        markRevoked(keyId);
      } else {
        forget(keyId);
        void refetch(pageAfterRemoval(page.value, total.value, DEFAULT_PAGE_SIZE));
      }
      return { ok: true };
    }
    const code = res.errorInfo?.code;
    if (code === 'not_found') {
      const listed = await refetch(pageAfterRemoval(page.value, total.value - 1, DEFAULT_PAGE_SIZE));
      if (listed.ok && !list.value.some(k => k.id === keyId)) {
        forget(keyId);
        return { ok: true, alreadyGone: true };
      }
      return { ok: false, code };
    }
    // The same codes that leave a mint's outcome unknown leave a delete's.
    if (action === 'delete' && mintOutcomeUnknown(code)) void refetch(page.value);
    return { ok: false, message: res.errorInfo?.message, code };
  }

  // ── Own keys ──

  async function fetchOwnKeys(pageNumber = 1): Promise<ActionResult> {
    const seq = ++ownSeq;
    ownLoading.value = true;
    try {
      const pfs = defaultPfsParams({ page: pageNumber });
      const res = await http.get<Page<ApiKeySummary>>(`/me/api-keys${pfsToQueryString(pfs)}`);
      if (seq !== ownSeq) return { ok: true };
      if (!res.success || !res.data) {
        ownError.value = res.errorInfo?.message ?? '';
        return { ok: false, message: res.errorInfo?.message };
      }
      ownError.value = null;
      ownKeys.value = res.data.items.map(withoutKey);
      ownTotal.value = res.data.total;
      ownPage.value = res.data.page;
      return { ok: true };
    } finally {
      if (seq === ownSeq) ownLoading.value = false;
    }
  }

  /**
   * Mints a key acting as the caller in the session's current organization.
   * The result's `data.key` is the only copy there will ever be; `code` is set
   * on failure so the dialog can point at the field that was wrong. The list
   * is fetched again from page one, where the new key now leads.
   */
  async function createOwnKey(request: CreateApiKeyRequest): Promise<ActionDataResult<ApiKeySummary>> {
    const res = await http.post<ApiKeySummary, CreateApiKeyRequest>('/me/api-keys', request);
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message, code: res.errorInfo?.code };
    }
    void fetchOwnKeys(1);
    return { ok: true, data: res.data };
  }

  function revokeOwnKey(keyId: string): Promise<KeyActionResult> {
    return act('own', 'revoke', keyId);
  }

  function deleteOwnKey(keyId: string): Promise<KeyActionResult> {
    return act('own', 'delete', keyId);
  }

  // ── Organization oversight ──

  /** Every key acting in the current organization, grouped by user (the API's own order). */
  async function fetchOrgKeys(pageNumber = 1, filters: OrgKeyFilters = lastOrgFilters): Promise<ActionResult> {
    const seq = ++orgSeq;
    orgLoading.value = true;
    lastOrgFilters = filters;
    try {
      const pfsFilters: PfsFilter[] = [];
      if (filters.userId) {
        pfsFilters.push({ table: 'api_keys', column: 'created_by', operator: 'eq', value: filters.userId });
      }
      const prefix = filters.prefix?.trim().slice(0, KEY_PREFIX_LENGTH);
      if (prefix) {
        // The API's `like` already matches anywhere in the column (and escapes
        // wildcards), so the text goes as typed. Every prefix opens with the same
        // `td_`, so "contains" finds what "starts with" would.
        pfsFilters.push({ table: 'api_keys', column: 'key_prefix', operator: 'like', value: prefix });
      }
      const pfs = defaultPfsParams({ page: pageNumber, filters: pfsFilters });
      const res = await http.get<Page<ApiKeySummary>>(`/api-keys${pfsToQueryString(pfs)}`);
      if (seq !== orgSeq) return { ok: true };
      if (!res.success || !res.data) {
        orgError.value = res.errorInfo?.message ?? '';
        return { ok: false, message: res.errorInfo?.message };
      }
      orgError.value = null;
      orgKeys.value = res.data.items.map(withoutKey);
      orgTotal.value = res.data.total;
      orgPage.value = res.data.page;
      return { ok: true };
    } finally {
      if (seq === orgSeq) orgLoading.value = false;
    }
  }

  /**
   * Every key in the organization, for pickers (the audit log's key filter).
   * The API answers at most {@link MAX_PAGE_SIZE} rows a page, so this pages
   * until it has them all — or meets an empty page, the only thing that ends
   * the loop should the total overstate the rows. A failed page fails the call
   * rather than offering a partial list. The oversight list is left as it is.
   */
  async function fetchOrgKeyChoices(): Promise<ActionDataResult<ApiKeySummary[]>> {
    const all: ApiKeySummary[] = [];
    for (let page = 1; ; page += 1) {
      const pfs = defaultPfsParams({ page, pageSize: MAX_PAGE_SIZE });
      const res = await http.get<Page<ApiKeySummary>>(`/api-keys${pfsToQueryString(pfs)}`, { disableLoading: true });
      if (!res.success || !res.data) {
        return { ok: false, message: res.errorInfo?.message };
      }
      all.push(...res.data.items.map(withoutKey));
      if (res.data.items.length === 0 || all.length >= res.data.total) break;
    }
    return { ok: true, data: all };
  }

  function revokeOrgKey(keyId: string): Promise<KeyActionResult> {
    return act('org', 'revoke', keyId);
  }

  function deleteOrgKey(keyId: string): Promise<KeyActionResult> {
    return act('org', 'delete', keyId);
  }

  /** Forgets everything — on sign-out, so the next user of the tab starts empty. */
  function clear() {
    ownSeq += 1;
    orgSeq += 1;
    ownKeys.value = [];
    ownTotal.value = 0;
    ownPage.value = 1;
    ownLoading.value = false;
    ownError.value = null;
    orgKeys.value = [];
    orgTotal.value = 0;
    orgPage.value = 1;
    orgLoading.value = false;
    orgError.value = null;
    lastOrgFilters = {};
  }

  return {
    ownKeys, ownTotal, ownPage, ownLoading, ownError,
    orgKeys, orgTotal, orgPage, orgLoading, orgError,
    fetchOwnKeys, createOwnKey, revokeOwnKey, deleteOwnKey,
    fetchOrgKeys, fetchOrgKeyChoices, revokeOrgKey, deleteOrgKey,
    clear,
  };
});

import { ref } from 'vue';
import { defineStore } from 'pinia';
import { http } from '@/config/requests';
import { defaultPfsParams, pfsToQueryString } from '@/utils/pfs';
import type { AuditLogEntry } from '@/data/audit/AuditDto';
import type { ActionResult } from '@/types/actions';
import type { Page, PfsFilter } from '@/types/pfs';

interface AuditFilters {
  /** Substring match on the action name. */
  action?: string;
  entityType?: string;
  actorUserId?: string;
  /** A key id, or {@link ANY_API_KEY} for every action that came through a key. */
  apiKeyId?: string;
}

/** `apiKeyId` filter value matching every entry made through an API key. */
export const ANY_API_KEY = '*';

/** Org audit log — PFS-paginated, newest first. */
export const useAuditStore = defineStore('audit', () => {
  const entries = ref<AuditLogEntry[]>([]);
  const total = ref<number>(0);
  const page = ref<number>(1);
  const loading = ref<boolean>(false);
  let lastFilters: AuditFilters = {};
  // Only the latest fetch may write the list: a slow page-1 answer must not
  // overwrite the page-2 one that was asked for after it.
  let seq = 0;

  async function fetchEntries(pageNumber = 1, filters: AuditFilters = lastFilters): Promise<ActionResult> {
    const mine = ++seq;
    loading.value = true;
    lastFilters = filters;
    try {
      const pfsFilters: PfsFilter[] = [];
      if (filters.action?.trim()) {
        pfsFilters.push({
          table: 'org_audit_log', column: 'action', operator: 'like',
          value: filters.action.trim(), ignoreCase: true,
        });
      }
      if (filters.entityType) {
        pfsFilters.push({
          table: 'org_audit_log', column: 'entity_type', operator: 'eq', value: filters.entityType,
        });
      }
      if (filters.actorUserId) {
        pfsFilters.push({
          table: 'org_audit_log', column: 'user_id', operator: 'eq', value: filters.actorUserId,
        });
      }
      if (filters.apiKeyId) {
        pfsFilters.push(filters.apiKeyId === ANY_API_KEY
          ? { table: 'org_audit_log', column: 'api_key_id', operator: 'notNull', value: '' }
          : { table: 'org_audit_log', column: 'api_key_id', operator: 'eq', value: filters.apiKeyId });
      }
      const pfs = defaultPfsParams({
        page: pageNumber,
        filters: pfsFilters,
        sorters: [{ table: 'org_audit_log', column: 'created_at', order: 'desc' }],
      });
      const res = await http.get<Page<AuditLogEntry>>(`/audit-log${pfsToQueryString(pfs)}`);
      if (mine !== seq) return { ok: true };
      if (!res.success || !res.data) {
        return { ok: false, message: res.errorInfo?.message };
      }
      entries.value = res.data.items;
      total.value = res.data.total;
      page.value = res.data.page;
      return { ok: true };
    } finally {
      if (mine === seq) loading.value = false;
    }
  }

  /** Forgets the entries and the filters — on sign-out, so the next user of the tab starts empty. */
  function clear() {
    seq += 1;
    entries.value = [];
    total.value = 0;
    page.value = 1;
    loading.value = false;
    lastFilters = {};
  }

  return { entries, total, page, loading, fetchEntries, clear };
});

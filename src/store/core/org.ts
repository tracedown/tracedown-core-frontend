import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { http } from '@/config/requests';
import { setStoredToken } from '@/utils/tokenStorage';
import { useAuthStore } from '@/store/core/auth';
import type { LoginResponse } from '@/data/auth/AuthDto';
import type { OrgMembership, SwitchOrgRequest } from '@/data/orgs/OrgDto';
import type { OrgSettings, UpdateOrgSettingsRequest } from '@/data/orgs/OrgSettingsDto';
import { setDateFormat as applyDateFormat, type DateFormat } from '@/lib/dateFormat';
import type { ActionResult, FetchOptions } from '@/types/actions';

/** Org memberships of the session user plus the active org's settings. */
export const useOrgStore = defineStore('org', () => {
  const orgs = ref<OrgMembership[]>([]);
  const selectedOrgId = ref<string | null>(null);
  const totpRequired = ref<boolean | null>(null);
  const defaultTimezone = ref<string | null>(null);
  const dateFormat = ref<DateFormat | null>(null);
  const orgName = ref<string | null>(null);
  const orgId = ref<string | null>(null);

  const currentOrg = computed(() =>
    orgs.value.find(o => o.id === selectedOrgId.value) ?? null);

  const hasOrgs = computed(() => orgs.value.length > 0);

  async function fetchOrgs(): Promise<ActionResult> {
    const res = await http.get<OrgMembership[]>('/auth/orgs', { disableLoading: true });
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    orgs.value = res.data;
    return { ok: true };
  }

  /** Populates orgs from pre-fetched data (used by bulk init). */
  function setOrgs(data: OrgMembership[]) {
    orgs.value = data;
  }

  function setSelectedOrg(orgId: string) {
    selectedOrgId.value = orgId;
  }

  /** Swaps the session to another org; the backend issues a fresh token. */
  async function switchOrg(orgId: string): Promise<ActionResult> {
    const res = await http.post<LoginResponse, SwitchOrgRequest>('/auth/switch-org', { orgId });
    if (!res.success || !res.data?.token) {
      return { ok: false, message: res.errorInfo?.message };
    }
    setStoredToken(res.data.token);
    useAuthStore().token = res.data.token;
    selectedOrgId.value = orgId;
    return { ok: true };
  }

  /** Loads the current org settings. Requires a session scoped to an org. */
  async function fetchSettings(opts: FetchOptions = {}): Promise<ActionResult> {
    const res = await http.get<OrgSettings>('/org/settings', { disableLoading: opts.silent });
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    totpRequired.value = res.data.totpRequired;
    defaultTimezone.value = res.data.defaultTimezone;
    dateFormat.value = res.data.dateFormat ?? null;
    // Another admin may have changed it (this runs on `settings.updated`).
    applyDateFormat(res.data.dateFormat);
    orgName.value = res.data.name;
    orgId.value = res.data.id;
    return { ok: true };
  }

  /** Toggles org-wide TOTP enforcement. */
  async function setTotpEnforced(value: boolean): Promise<ActionResult> {
    const res = await http.patch<OrgSettings, UpdateOrgSettingsRequest>('/org/settings', {
      totpRequired: value,
    });
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    totpRequired.value = res.data.totpRequired;
    return { ok: true };
  }

  /** Renames the organization. */
  async function updateName(name: string): Promise<ActionResult> {
    const res = await http.patch<OrgSettings, UpdateOrgSettingsRequest>('/org/settings', { name });
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    orgName.value = res.data.name;
    // The membership list is a second copy of the name and backs `currentOrg`,
    // which the org switcher renders. Without this it keeps the old name until
    // the next `fetchOrgs` — i.e. until a reload.
    const membership = orgs.value.find(o => o.id === res.data?.id);
    if (membership) membership.name = res.data.name;
    return { ok: true };
  }

  /** Sets the org-wide default timezone (maintenance windows etc.). */
  async function setDefaultTimezone(value: string): Promise<ActionResult> {
    const res = await http.patch<OrgSettings, UpdateOrgSettingsRequest>('/org/settings', {
      defaultTimezone: value,
    });
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    defaultTimezone.value = res.data.defaultTimezone;
    return { ok: true };
  }

  /** Sets the org-wide date format every member sees. */
  async function setDateFormat(value: DateFormat): Promise<ActionResult> {
    const res = await http.patch<OrgSettings, UpdateOrgSettingsRequest>('/org/settings', {
      dateFormat: value,
    });
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    dateFormat.value = res.data.dateFormat;
    applyDateFormat(res.data.dateFormat);
    return { ok: true };
  }

  /** Deletes the org outright (owner-only; password + TOTP verified). */
  async function deleteOrg(password: string, code?: string): Promise<ActionResult> {
    const res = await http.delete<{ ok: boolean }, { password: string; code?: string }>('/org', { password, code });
    if (!res.success) {
      return { ok: false, message: res.errorInfo?.message };
    }
    return { ok: true };
  }

  function clear() {
    orgs.value = [];
    selectedOrgId.value = null;
    totpRequired.value = null;
    defaultTimezone.value = null;
    dateFormat.value = null;
    orgName.value = null;
    orgId.value = null;
  }

  return {
    orgs, selectedOrgId, totpRequired, currentOrg, hasOrgs,
    fetchOrgs, setOrgs, setSelectedOrg, switchOrg,
    fetchSettings, setTotpEnforced, setDefaultTimezone, setDateFormat, updateName, deleteOrg,
    defaultTimezone, dateFormat, orgName, orgId, clear,
  };
}, {
  persist: {
    pick: ['selectedOrgId'],
  },
});

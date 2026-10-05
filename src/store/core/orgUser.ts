import { ref } from 'vue';
import { defineStore } from 'pinia';
import { http } from '@/config/requests';
import type { Page } from '@/types/pfs';
import { defaultPfsParams, pfsToQueryString } from '@/utils/pfs';
import type { OrgSectionPermissions, OrgUserSummary, PermissionSet, ResourceGrant, UpdatePermissionsRequest } from '@/data/orgs/PermissionDto';
import type { InviteRequest, InviteResponse, PendingInvite } from '@/data/orgs/InviteDto';
import type { ActionDataResult, ActionResult, FetchOptions } from '@/types/actions';

/** Organization members, pending invites, and per-user permissions. */
export const useOrgUserStore = defineStore('orgUser', () => {
  const users = ref<OrgUserSummary[]>([]);
  const totalUsers = ref<number>(0);
  const usersLoading = ref<boolean>(false);
  const usersLoaded = ref<boolean>(false);

  const invites = ref<PendingInvite[]>([]);
  const invitesLoaded = ref<boolean>(false);

  async function fetchUsers(opts: FetchOptions = {}): Promise<ActionResult> {
    if (!opts.force && usersLoaded.value) {
      return { ok: true };
    }
    if (!opts.silent) usersLoading.value = true;
    try {
      const res = await http.get<Page<OrgUserSummary>>('/users', { disableLoading: opts.silent });
      if (!res.success || !res.data) {
        return { ok: false, message: res.errorInfo?.message };
      }
      users.value = res.data.items;
      totalUsers.value = res.data.total;
      usersLoaded.value = true;
      return { ok: true };
    } finally {
      usersLoading.value = false;
    }
  }

  /**
   * Every member, for pickers (filters by member). The API answers at most 100
   * rows a page, so this pages until it has them all — or meets an empty page,
   * which bounds the loop should the total overstate the rows. A failed page
   * fails the whole call rather than offering a partial list. Leaves `users`
   * as it is.
   */
  async function fetchOrgUserChoices(): Promise<ActionDataResult<OrgUserSummary[]>> {
    const byId = new Map<string, OrgUserSummary>();
    let seen = 0;
    for (let page = 1; ; page += 1) {
      const pfs = defaultPfsParams({ page, pageSize: 100 });
      const res = await http.get<Page<OrgUserSummary>>(`/users${pfsToQueryString(pfs)}`, { disableLoading: true });
      if (!res.success || !res.data) {
        return { ok: false, message: res.errorInfo?.message };
      }
      res.data.items.forEach(u => byId.set(u.userId, u));
      seen += res.data.items.length;
      if (res.data.items.length === 0 || seen >= res.data.total) break;
    }
    return { ok: true, data: [...byId.values()] };
  }

  async function fetchInvites(opts: FetchOptions = {}): Promise<ActionResult> {
    if (!opts.force && invitesLoaded.value) {
      return { ok: true };
    }
    const res = await http.get<Page<PendingInvite>>('/invites', { disableLoading: opts.silent });
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    invites.value = res.data.items;
    invitesLoaded.value = true;
    return { ok: true };
  }

  /** Sends (or resends) an invitation, then refreshes the pending list. */
  async function inviteUser(email: string, groupIds?: string[]): Promise<ActionResult> {
    const res = await http.post<InviteResponse, InviteRequest>('/invites', { email, groupIds });
    if (!res.success) {
      return { ok: false, message: res.errorInfo?.message };
    }
    return fetchInvites({ force: true, silent: true });
  }

  async function revokeInvite(inviteId: string): Promise<ActionResult> {
    const res = await http.delete(`/invites/${inviteId}`);
    if (!res.success) {
      return { ok: false, message: res.errorInfo?.message };
    }
    invites.value = invites.value.filter(i => i.id !== inviteId);
    return { ok: true };
  }

  /** Full permission set (incl. resource grants) of one member. Requires users.write. */
  async function fetchUserPermissions(userId: string): Promise<ActionDataResult<PermissionSet>> {
    const res = await http.get<PermissionSet>(`/users/${userId}/permissions`);
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    return { ok: true, data: res.data };
  }

  /** Updates a member's org-section levels; resource grants are left unchanged. */
  async function updateUserPermissions(
    userId: string,
    org: OrgSectionPermissions,
  ): Promise<ActionResult> {
    const res = await http.patch<PermissionSet, UpdatePermissionsRequest>(
      `/users/${userId}/permissions`,
      { org },
    );
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    const user = users.value.find(u => u.userId === userId);
    if (user) user.org = res.data.org;
    // Pending invites are permission-editable the same way.
    const invite = invites.value.find(i => i.userId === userId);
    if (invite) invite.org = res.data.org;
    return { ok: true };
  }

  /** Enables/disables a member. Disabled members keep their data but lose access. */
  async function toggleUserActive(userId: string, isActive: boolean): Promise<ActionResult> {
    const res = await http.post<{ ok: boolean }, { isActive: boolean }>(
      `/users/${userId}/toggle`,
      { isActive },
    );
    if (!res.success) {
      return { ok: false, message: res.errorInfo?.message };
    }
    const user = users.value.find(u => u.userId === userId);
    if (user) user.isActive = isActive;
    return { ok: true };
  }

  /** Removes a member from the org. */
  async function removeUser(userId: string): Promise<ActionResult> {
    const res = await http.delete<{ ok: boolean }>(`/users/${userId}`);
    if (!res.success) {
      return { ok: false, message: res.errorInfo?.message };
    }
    users.value = users.value.filter(u => u.userId !== userId);
    return { ok: true };
  }

  /** Transfers org ownership. Owner-only; the API re-verifies password + TOTP. */
  async function transferOwnership(newOwnerId: string, password: string, code?: string): Promise<ActionResult> {
    const res = await http.post<unknown, { newOwnerId: string; password: string; code?: string }>(
      '/org/transfer',
      { newOwnerId, password, code },
    );
    if (!res.success) {
      return { ok: false, message: res.errorInfo?.message };
    }
    return { ok: true };
  }

  /** Replaces a member's resource grants; org sections are left unchanged. */
  async function updateUserResources(
    userId: string,
    resources: ResourceGrant[],
  ): Promise<ActionDataResult<ResourceGrant[]>> {
    const res = await http.patch<PermissionSet, UpdatePermissionsRequest>(
      `/users/${userId}/permissions`,
      { resources },
    );
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    return { ok: true, data: res.data.resources };
  }

  /** Local bookkeeping after a group add/remove (the API call lives in the group store). */
  function applyGroupMembership(userId: string, groupId: string, added: boolean) {
    const user = users.value.find(u => u.userId === userId);
    if (user) {
      user.groupIds = added
        ? [...user.groupIds, groupId]
        : user.groupIds.filter(id => id !== groupId);
    }
    // Pending invites carry pre-assigned groups editable the same way.
    const invite = invites.value.find(i => i.userId === userId);
    if (invite) {
      const current = invite.groupIds ?? [];
      invite.groupIds = added
        ? [...current, groupId]
        : current.filter(id => id !== groupId);
    }
  }

  /** Live-sync hooks: silently refetch lists that are already loaded. */
  function refreshUsers() {
    if (usersLoaded.value) void fetchUsers({ force: true, silent: true });
  }

  function refreshInvites() {
    if (invitesLoaded.value) void fetchInvites({ force: true, silent: true });
  }

  function clear() {
    users.value = [];
    totalUsers.value = 0;
    usersLoaded.value = false;
    invites.value = [];
    invitesLoaded.value = false;
  }

  return {
    users, totalUsers, usersLoading, invites,
    fetchUsers, fetchOrgUserChoices, fetchInvites, inviteUser, revokeInvite,
    refreshUsers, refreshInvites,
    toggleUserActive, removeUser, transferOwnership,
    fetchUserPermissions, updateUserPermissions, updateUserResources, applyGroupMembership, clear,
  };
});

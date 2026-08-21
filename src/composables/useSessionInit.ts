import { bulk } from '@/config/requests';
import { defaultPfsParams, pfsToQueryString } from '@/utils/pfs';
import { useAuthStore } from '@/store/core/auth';
import { useOrgStore } from '@/store/core/org';
import { useSilenceStore } from '@/store/core/silence';
import { useSystemAlertStore } from '@/store/core/systemAlert';
import { useWorkspaceStore } from '@/store/core/workspace';
import type { MeResponse } from '@/data/auth/AuthDto';
import type { OrgMembership } from '@/data/orgs/OrgDto';
import type { Page } from '@/types/pfs';
import type { SilenceSummary } from '@/data/silences/SilenceDto';
import type { SystemAlertSummary } from '@/data/alerts/SystemAlertDto';
import type { WorkspaceListResponse } from '@/data/workspaces/WorkspaceDto';

const ME_URL = '/auth/me';
const ORGS_URL = '/auth/orgs';
const WORKSPACES_URL = '/workspaces';
// Must mirror the silence store's own ensureLoaded query.
const SILENCES_URL = `/silences${pfsToQueryString(defaultPfsParams({ pageSize: 100 }), '?')}`;
const SYSTEM_ALERTS_URL = '/system-alerts';

/**
 * Whether a session restore already ran this page load — set by `initSession`
 * itself, so a caller that restores directly (login, invite acceptance) spares
 * the router guard a second identical round-trip on the next navigation.
 */
let restored = false;

/** Whether {@link initSession} has run since the page loaded. */
export function isSessionRestored(): boolean {
  return restored;
}

/** Records a restore as unnecessary (no token to restore from). */
export function markSessionRestored(): void {
  restored = true;
}

/**
 * Restores a session in a single bulk round-trip. Essentials (/auth/me,
 * /auth/orgs, /workspaces) gate the result; the shell's mount-time data
 * (silences for the bells, system alerts for admins) piggybacks on the same
 * round-trip and pre-seeds the stores — their sub-failures are non-fatal
 * (e.g. /system-alerts is 403 for non-admins).
 */
export async function initSession(): Promise<boolean> {
  restored = true;
  const authStore = useAuthStore();
  const orgStore = useOrgStore();
  const silenceStore = useSilenceStore();

  const res = await bulk(
    [
      { method: 'GET', url: ME_URL },
      { method: 'GET', url: ORGS_URL },
      { method: 'GET', url: WORKSPACES_URL },
      { method: 'GET', url: SILENCES_URL },
      { method: 'GET', url: SYSTEM_ALERTS_URL },
    ],
    { disableLoading: true },
  );

  if (!res.success || !res.data) {
    authStore.clearSession();
    return false;
  }

  const calls = res.data.calls;
  const meCall = calls.find(c => c.request.url === ME_URL);
  if (!meCall || meCall.response.status !== 200) {
    authStore.clearSession();
    return false;
  }
  const me = meCall.response.body as MeResponse;
  authStore.setSession(me);

  const orgsCall = calls.find(c => c.request.url === ORGS_URL);
  orgStore.setOrgs(
    orgsCall?.response.status === 200 ? (orgsCall.response.body as OrgMembership[]) : [],
  );

  // Silences are personal (user-scoped) — safe regardless of the org scope.
  const silencesCall = calls.find(c => c.request.url === SILENCES_URL);
  if (silencesCall?.response.status === 200) {
    silenceStore.seed((silencesCall.response.body as Page<SilenceSummary>).items);
  }

  const workspacesCall = calls.find(c => c.request.url === WORKSPACES_URL);
  const bulkWorkspaces = workspacesCall?.response.status === 200
    ? (workspacesCall.response.body as WorkspaceListResponse)
    : null;
  // Non-200 (403 for non-admins) seeds empty — the shell must not retry a fetch
  // the user isn't allowed to make.
  const alertsCall = calls.find(c => c.request.url === SYSTEM_ALERTS_URL);
  const bulkAlerts = alertsCall?.response.status === 200
    ? (alertsCall.response.body as SystemAlertSummary[])
    : [];

  return reconcileOrgScope(me.organizationId ?? null, bulkWorkspaces, bulkAlerts);
}

/**
 * Aligns the selected org with the org the session's token is actually scoped to.
 *
 * The persisted `selectedOrgId` and the user's stored `last_org` can both point at
 * an org the user has since lost access to (removed/disabled). Trusting them shows
 * that org in the header while the token — still scoped elsewhere — returns no data
 * ("no workspace available"). So the session's own org is authoritative: when it's
 * still a live membership we keep it and use the bulk data; when it isn't, we
 * re-scope the session to a valid org (a fresh token) and refetch its workspaces.
 */
async function reconcileOrgScope(
  sessionOrg: string | null,
  bulkWorkspaces: WorkspaceListResponse | null,
  bulkAlerts: SystemAlertSummary[],
): Promise<boolean> {
  const authStore = useAuthStore();
  const orgStore = useOrgStore();
  const workspaceStore = useWorkspaceStore();
  const systemAlertStore = useSystemAlertStore();

  const isValid = (id: string | null | undefined): id is string =>
    id != null && orgStore.orgs.some(o => o.id === id);

  // Session's org still valid → it and the bulk data (fetched under it) are good.
  if (isValid(sessionOrg)) {
    orgStore.setSelectedOrg(sessionOrg);
    if (bulkWorkspaces) workspaceStore.setWorkspaces(bulkWorkspaces);
    systemAlertStore.seed(bulkAlerts);
    return true;
  }

  // No memberships left → the "no organizations" screen (no org scope to fix).
  if (!orgStore.hasOrgs) {
    systemAlertStore.seed([]);
    return true;
  }

  // Token points at a lost org: re-scope to the user's last valid org (or the
  // first) with a fresh token, then refetch that org's workspaces.
  const target = isValid(authStore.user?.selectedOrgId)
    ? authStore.user!.selectedOrgId!
    : orgStore.orgs[0].id;
  const switched = await orgStore.switchOrg(target);
  if (!switched.ok) {
    authStore.clearSession();
    return false;
  }
  await workspaceStore.fetchWorkspaces({ silent: true });
  // Alerts belong to the new org; leave the seed empty so OrgLiveSync fetches them.
  systemAlertStore.seed([]);
  return true;
}

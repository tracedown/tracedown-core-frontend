import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { http } from '@/config/requests';
import { getStoredToken, setStoredToken, clearStoredToken } from '@/utils/tokenStorage';
import {
  beginForcedTotpEnroll,
  beginTotpEnroll,
  changePassword,
  closeAccount,
  confirmPasswordReset,
  fetchDataExport,
  fetchInviteInfo,
  fetchProfileCapabilities,
  regenerateRecoveryCodes,
  requestPasswordReset,
} from '@/lib/authApi';
import type {
  ChangeEmailRequest,
  LoginRequest,
  LoginResponse,
  MeResponse,
  OrgPermissions,
  TotpConfirmResponse,
  TotpDisableRequest,
  UpdateProfileRequest,
  TotpVerifyRequest,
} from '@/data/auth/AuthDto';
import type { UserSummary } from '@/data/user/UserDto';
import type { AcceptInviteRequest, AcceptInviteResponse } from '@/data/orgs/InviteDto';
import type { AccessSection } from '@/types/access';
import type { ActionResult } from '@/types/actions';

/**
 * What a password login resolved to: a session, a TOTP challenge to answer,
 * a forced enrollment (org policy) to complete, or a failure.
 */
type LoginOutcome =
  | { status: 'success' }
  | { status: 'totp_required'; challenge: string }
  | { status: 'totp_setup_required'; setupToken: string }
  | { status: 'error'; message?: string };

interface LoginResult {
  ok: boolean;
  /** Resolved, user-facing message when `ok` is false. */
  message?: string;
}

interface TotpConfirmResult {
  ok: boolean;
  recoveryCodes?: string[];
  message?: string;
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(getStoredToken());
  const user = ref<UserSummary | null>(null);
  const permissions = ref<OrgPermissions | null>(null);
  /** Effective resource grants (own + groups), keyed "type::id" → level. */
  const orgDefaultTimezone = ref<string>('UTC');
  const trustedDomainMode = ref<boolean>(false);
  const resources = ref<Record<string, number>>({});

  const isAuthenticated = computed(() => token.value != null);
  const isOwner = computed(() => permissions.value?.isOwner ?? false);

  function levelOf(section: AccessSection): number {
    if (!permissions.value) return 0;
    if (permissions.value.isOwner) return 2;
    return permissions.value[section] ?? 0;
  }

  function canRead(section: AccessSection): boolean {
    return levelOf(section) >= 1;
  }

  function canWrite(section: AccessSection): boolean {
    return levelOf(section) >= 2;
  }

  /** Highest explicit grant across the given keys ("type::id", parents included). */
  function grantLevel(keys: string[]): number {
    return keys.reduce((max, key) => Math.max(max, resources.value[key] ?? 0), 0);
  }

  /**
   * Explicit grant (own or via group, incl. implicit parent grants) — the
   * same eligibility notifications use. Owners/admins without a grant are
   * deliberately NOT covered.
   */
  function hasResourceGrant(keys: string[]): boolean {
    return grantLevel(keys) >= 1;
  }

  /** Write on a resource: org-wide workspaces write, ownership, or a write grant. */
  function canWriteScoped(keys: string[]): boolean {
    return canWrite('workspaces') || grantLevel(keys) >= 2;
  }

  /** Stores the session carried by a login-shaped response. */
  function adoptSession(data: LoginResponse) {
    if (!data.token) return;
    token.value = data.token;
    setStoredToken(data.token);
    if (data.user) user.value = data.user;
  }

  /**
   * Password login. Resolves to a session, a TOTP challenge, or a forced
   * enrollment (when the org enforces TOTP and the user hasn't enrolled).
   */
  async function login(credentials: LoginRequest): Promise<LoginOutcome> {
    const res = await http.post<LoginResponse, LoginRequest>('/auth/login', credentials);
    if (!res.success || !res.data) {
      return { status: 'error', message: res.errorInfo?.message };
    }
    if (res.data.totpRequired && res.data.challenge) {
      return { status: 'totp_required', challenge: res.data.challenge };
    }
    if (res.data.totpSetupRequired && res.data.setupToken) {
      return { status: 'totp_setup_required', setupToken: res.data.setupToken };
    }
    if (!res.data.token) {
      return { status: 'error' };
    }
    adoptSession(res.data);
    return { status: 'success' };
  }

  /** Answers a login TOTP challenge. `code` may be a TOTP or a recovery code. */
  async function verifyTotpLogin(challenge: string, code: string): Promise<LoginResult> {
    const res = await http.post<LoginResponse, TotpVerifyRequest>('/auth/login/totp', { challenge, code });
    if (!res.success || !res.data?.token) {
      return { ok: false, message: res.errorInfo?.message };
    }
    adoptSession(res.data);
    return { ok: true };
  }

  /** Loads the session user + permissions. Clears the session on failure. */
  async function fetchMe(): Promise<boolean> {
    const res = await http.get<MeResponse>('/auth/me', { disableLoading: true });
    if (!res.success || !res.data) {
      clearSession();
      return false;
    }
    setSession(res.data);
    return true;
  }

  /** Populates user and permissions from a MeResponse (used by bulk init). */
  function setSession(me: MeResponse) {
    user.value = me.user;
    permissions.value = me.permissions;
    resources.value = me.resources ?? {};
    orgDefaultTimezone.value = me.orgDefaultTimezone ?? 'UTC';
    trustedDomainMode.value = me.trustedDomainMode ?? false;
  }

  /** Clears all auth state and the stored token. */
  function clearSession() {
    user.value = null;
    token.value = null;
    permissions.value = null;
    resources.value = {};
    clearStoredToken();
  }

  /**
   * Accepts an invite. A new user passes a password + display name (creating the
   * account and a session); an existing user passes neither and accepts via their
   * current session. Returns the outcome so the view can route accordingly.
   */
  async function acceptInvite(
    token: string,
    body?: { displayName?: string; password?: string },
  ): Promise<{ ok: boolean; status?: AcceptInviteResponse['status']; message?: string }> {
    const res = await http.post<AcceptInviteResponse, AcceptInviteRequest>(
      `/invites/${token}/accept`,
      { password: body?.password, displayName: body?.displayName },
    );
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    // Both accepted paths return a fresh session scoped to the joined org — adopt
    // it so `initSession` lands the user in that org. login_required has no token.
    if (res.data.token) {
      adoptSession({ token: res.data.token } as LoginResponse);
    }
    return { ok: true, status: res.data.status };
  }

  /** Updates the display name and refreshes the session user. */
  async function updateProfile(displayName: string): Promise<ActionResult> {
    const res = await http.patch<UserSummary, UpdateProfileRequest>('/auth/profile', { displayName });
    if (!res.success) {
      return { ok: false, message: res.errorInfo?.message };
    }
    if (user.value && res.data) user.value = { ...user.value, displayName: res.data.displayName };
    return { ok: true };
  }

  /**
   * Changes the account email. Requires the current password (plus a TOTP code
   * when enrolled); the server revokes every other session. On success the
   * session user is refreshed from the returned profile.
   */
  async function changeEmail(newEmail: string, currentPassword: string, code?: string): Promise<ActionResult> {
    const res = await http.post<UserSummary, ChangeEmailRequest>('/me/email', { newEmail, currentPassword, code });
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    user.value = res.data;
    return { ok: true };
  }

  /** Confirms enrollment with a TOTP code; on success a fresh session is stored. */
  async function confirmTotpEnroll(confirmToken: string, code: string): Promise<TotpConfirmResult> {
    const res = await http.post<TotpConfirmResponse, { confirmToken: string; code: string }>(
      '/auth/totp/setup/confirm',
      { confirmToken, code },
    );
    if (!res.success || !res.data) {
      return { ok: false, message: res.errorInfo?.message };
    }
    if (res.data.token) {
      token.value = res.data.token;
      setStoredToken(res.data.token);
    }
    if (user.value) {
      user.value = { ...user.value, totpEnabled: true };
    }
    return { ok: true, recoveryCodes: res.data.recoveryCodes ?? [] };
  }

  /** Disables TOTP for the current user. `code` may be a TOTP or a recovery code. */
  async function disableTotp(code: string): Promise<ActionResult> {
    const res = await http.post<{ ok: boolean }, TotpDisableRequest>('/auth/totp/disable', { code });
    if (!res.success) {
      return { ok: false, message: res.errorInfo?.message };
    }
    if (user.value) {
      user.value = { ...user.value, totpEnabled: false };
    }
    return { ok: true };
  }

  /** Revokes the server session and synchronously drops all local auth state. */
  function logout() {
    // The revoke call must carry the token explicitly: local state is cleared
    // synchronously (callers navigate right after, and the login-route guard
    // needs the token gone), so by the time the request interceptor asks for
    // the stored token it no longer exists. A failure is deliberately ignored
    // — and a 401 from an already-expired session must not bounce through the
    // global unauthorized redirect mid-logout.
    const bearer = token.value;
    if (bearer) {
      void http.delete('/auth/logout', {
        disableLoading: true,
        suppressUnauthorized: true,
        headers: { Authorization: `Bearer ${bearer}` },
      });
    }
    clearSession();
  }

  return {
    token, user, permissions, isAuthenticated, isOwner,
    canRead, canWrite, hasResourceGrant, canWriteScoped,
    login, verifyTotpLogin, acceptInvite, fetchMe, setSession, clearSession,
    orgDefaultTimezone, trustedDomainMode,
    updateProfile, changeEmail, confirmTotpEnroll, disableTotp, logout,
    // Session-stateless account calls (lib/authApi), re-exposed unchanged so
    // components keep a single auth surface.
    fetchInviteInfo, requestPasswordReset, confirmPasswordReset,
    fetchProfileCapabilities, changePassword, fetchDataExport, closeAccount,
    beginTotpEnroll, beginForcedTotpEnroll, regenerateRecoveryCodes,
  };
});

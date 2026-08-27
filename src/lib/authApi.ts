import { http } from '@/config/requests';
import type {
  ChangePasswordRequest,
  DeleteAccountRequest,
  PasswordResetConfirmRequest,
  PasswordResetRequest,
  ProfileCapabilities,
  TotpDisableRequest,
  TotpSetupRequest,
  TotpSetupResponse,
} from '@/data/auth/AuthDto';
import type { InviteInfo } from '@/data/orgs/InviteDto';
import type { UserDataExport } from '@/data/user/UserDto';
import type { ActionDataResult, ActionResult } from '@/types/actions';

/**
 * Session-stateless account/credential API calls. None of these touch the
 * auth store's refs — they are plain request/response actions the store
 * re-exposes so components keep a single auth surface.
 */

export interface TotpEnrollResult {
  ok: boolean;
  data?: TotpSetupResponse;
  message?: string;
}

/** Public info for the invite-accept form (org name, invited email). */
export async function fetchInviteInfo(token: string): Promise<ActionDataResult<InviteInfo>> {
  const res = await http.get<InviteInfo>(`/invites/${token}`);
  if (!res.success || !res.data) {
    return { ok: false, message: res.errorInfo?.message };
  }
  return { ok: true, data: res.data };
}

/** Requests a reset email. Always succeeds — no account enumeration. */
export async function requestPasswordReset(email: string): Promise<ActionResult> {
  const res = await http.post<{ ok: boolean }, PasswordResetRequest>('/auth/password-reset', { email });
  if (!res.success) {
    return { ok: false, message: res.errorInfo?.message };
  }
  return { ok: true };
}

/** Sets a new password using the token from the reset email. */
export async function confirmPasswordReset(token: string, newPassword: string): Promise<ActionResult> {
  const res = await http.post<{ ok: boolean }, PasswordResetConfirmRequest>('/auth/password-reset/confirm', { token, newPassword });
  if (!res.success) {
    return { ok: false, message: res.errorInfo?.message };
  }
  return { ok: true };
}

/**
 * What this user may do to their own account, and what stands in the way of
 * closing it. Falls back to the most restrictive answer if the call fails —
 * a section that cannot confirm it is allowed does not offer itself.
 */
export async function fetchProfileCapabilities(): Promise<ProfileCapabilities> {
  const res = await http.get<ProfileCapabilities>('/auth/profile/capabilities');
  if (!res.success || !res.data) {
    return { allowProfileEdit: false, allowAccountClosure: false, ownedOrgs: [] };
  }
  return {
    allowProfileEdit: res.data.allowProfileEdit === true,
    allowAccountClosure: res.data.allowAccountClosure === true,
    ownedOrgs: res.data.ownedOrgs ?? [],
  };
}

/**
 * Closes the current account. Requires the password, plus a TOTP or recovery
 * code when two-factor is enrolled. `deleteOwnedOrgs` takes along the owned
 * organizations this account is the only member of; anything with other
 * members has to be handed over first and is refused either way.
 */
export async function closeAccount(request: DeleteAccountRequest): Promise<ActionResult> {
  const res = await http.delete<{ ok: boolean }, DeleteAccountRequest>('/auth/account', request);
  if (!res.success) {
    return { ok: false, message: res.errorInfo?.message };
  }
  return { ok: true };
}

/** Changes the password; requires the current one. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<ActionResult> {
  const res = await http.post<{ ok: boolean }, ChangePasswordRequest>('/auth/change-password', { currentPassword, newPassword });
  if (!res.success) {
    return { ok: false, message: res.errorInfo?.message };
  }
  return { ok: true };
}

/** Fetches the full personal data export document for the current user. */
export async function fetchDataExport(): Promise<ActionDataResult<UserDataExport>> {
  const res = await http.get<UserDataExport>('/me/export');
  if (!res.success || !res.data) {
    return { ok: false, message: res.errorInfo?.message };
  }
  return { ok: true, data: res.data };
}

/** Begins authenticated TOTP enrollment for the current session user. */
export async function beginTotpEnroll(): Promise<TotpEnrollResult> {
  const res = await http.post<TotpSetupResponse, Record<string, never>>('/auth/totp/enroll', {});
  if (!res.success || !res.data) {
    return { ok: false, message: res.errorInfo?.message };
  }
  return { ok: true, data: res.data };
}

/** Begins the enrollment forced at login, using the setup token from the login response. */
export async function beginForcedTotpEnroll(setupToken: string): Promise<TotpEnrollResult> {
  const res = await http.post<TotpSetupResponse, TotpSetupRequest>('/auth/totp/setup', { setupToken });
  if (!res.success || !res.data) {
    return { ok: false, message: res.errorInfo?.message };
  }
  return { ok: true, data: res.data };
}

/** Regenerates the user's TOTP recovery codes; returns the fresh set on success. */
export async function regenerateRecoveryCodes(code: string): Promise<{ ok: boolean; codes?: string[]; message?: string }> {
  const res = await http.post<{ recoveryCodes: string[] }, TotpDisableRequest>('/auth/totp/recovery-codes', { code });
  if (!res.success || !res.data) {
    return { ok: false, message: res.errorInfo?.message };
  }
  return { ok: true, codes: res.data.recoveryCodes };
}

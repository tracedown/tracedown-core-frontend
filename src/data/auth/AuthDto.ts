import { UserSummary } from "@/data/user/UserDto";
import type { AccessSection } from "@/types/access";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string | null;
  expiresAt: string | null;
  user: UserSummary | null;
  totpRequired: boolean;
  challenge: string | null;
  totpSetupRequired: boolean;
  setupToken: string | null;
  recoveryCodes: string[] | null;
}

/** Request of POST /auth/login/totp — `code` accepts a TOTP or a recovery code. */
export interface TotpVerifyRequest {
  challenge: string;
  code: string;
}

/** Request of POST /auth/totp/setup — begins enrollment forced at login. */
export interface TotpSetupRequest {
  setupToken: string;
}

/** Request of POST /auth/totp/disable — `code` accepts a TOTP or a recovery code. */
export interface TotpDisableRequest {
  code: string;
}

/**
 * An organization the current account owns. `soleMember` means nobody else
 * holds a membership, so it can be deleted along with the account instead of
 * having to be handed to someone first.
 */
export interface OwnedOrgSummary {
  id: string;
  name: string;
  soleMember: boolean;
}

/** Response of GET /auth/profile/capabilities. */
export interface ProfileCapabilities {
  allowProfileEdit: boolean;
  allowAccountClosure: boolean;
  /** Empty unless closure is allowed — only that section reads it. */
  ownedOrgs: OwnedOrgSummary[];
}

/** Request of DELETE /auth/account — `code` accepts a TOTP or a recovery code. */
export interface DeleteAccountRequest {
  password: string;
  code?: string;
  /** Delete the owned organizations this account is the only member of. */
  deleteOwnedOrgs?: boolean;
}

/**
 * Per-section permission levels of the session's org membership:
 * 0 none, 1 read, 2 write. Owners bypass section levels entirely.
 */
export type OrgPermissions = Record<AccessSection, number> & {
  isOwner: boolean;
};

/** Response of GET /auth/me. */
export interface MeResponse {
  user: UserSummary;
  /** The org this session's token is scoped to (null without org context). */
  organizationId?: string | null;
  permissions: OrgPermissions | null;
  /** Effective resource grants (own + groups), keyed "type::id" -> level. */
  resources?: Record<string, number>;
  /** The selected org's default IANA timezone (null without org context). */
  orgDefaultTimezone?: string | null;
  /** Platform flag: when true, domain verification is a no-op (no Domains UI). */
  trustedDomainMode?: boolean;
}

/** Response of POST /auth/totp/enroll — the QR/secret payload for enrollment. */
export interface TotpSetupResponse {
  secret: string;
  otpauthUri: string;
  confirmToken: string;
}

/** Response of POST /auth/totp/setup/confirm — a fresh session plus one-time codes. */
export interface TotpConfirmResponse {
  token: string | null;
  expiresAt: string | null;
  recoveryCodes: string[] | null;
}

/** Request of POST /auth/password-reset. */
export interface PasswordResetRequest {
  email: string;
}

/** Request of POST /auth/password-reset/confirm. */
export interface PasswordResetConfirmRequest {
  token: string;
  newPassword: string;
}

/** Request of PATCH /auth/profile. */
export interface UpdateProfileRequest {
  displayName: string;
}

/** Request of POST /auth/change-password. */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** Request of POST /me/email — `code` (TOTP or recovery) is required when enrolled. */
export interface ChangeEmailRequest {
  newEmail: string;
  currentPassword: string;
  code?: string;
}

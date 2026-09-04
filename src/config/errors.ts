/**
 * Error-code vocabulary and resolution — the single host-side home for codes.
 *
 * The requests library is generic over the code type and owns no vocabulary; it
 * only emits the transport-level codes it can detect ({@link TransportErrorCode},
 * which this union includes). Everything else is backend-defined here, and
 * resolution to a user-facing string goes through i18n (`errors.<code>`).
 */

import i18n from '@/plugins/i18n';
import type { TransportErrorCode } from '@/requests';

export type ErrorCode =
  | TransportErrorCode
  // Auth
  | 'invalid_credentials'
  | 'account_deactivated'
  | 'session_expired'
  | 'missing_auth_header'
  | 'invalid_token'
  | 'invalid_totp_code'
  | 'totp_not_configured'
  | 'setup_token_expired'
  | 'invalid_setup_token'
  // Invites
  | 'invalid_invite_token'
  | 'invite_expired'
  | 'invite_cooldown'
  // Validation
  | 'field_required'
  | 'field_too_long'
  | 'field_invalid'
  | 'invalid_request_body'
  | 'invalid_uuid'
  // Resources
  | 'not_found'
  | 'already_exists'
  | 'agent_slug_taken'
  | 'version_conflict'
  // Permissions
  | 'forbidden'
  | 'not_org_member'
  | 'insufficient_permissions'
  | 'no_org_selected'
  // Password / profile
  | 'password_too_short'
  | 'password_too_weak'
  | 'incorrect_password'
  | 'profile_edit_disabled'
  | 'account_closure_disabled'
  | 'account_owns_organizations'
  | 'email_taken'
  // Rate limit / general
  | 'rate_limited'
  | 'internal_error'
  | 'not_supported';

/**
 * Resolves an error code to its localized message, falling back to the generic
 * unknown-error string for any code without a translation.
 */
export function resolveError(code: string): string {
  const key = `errors.${code}`;
  const message = i18n.global.t(key);
  return message === key ? i18n.global.t('errors.unknown_error') : message;
}

/**
 * The decisions of the API key screens that are not layout: what a refused
 * mint means for the form, what the expiry choice sends, where a key is used,
 * which page to show after a row goes, how a key's state and holder read, and
 * which toast an action earns.
 */

import type { ApiKeySummary } from '@/data/apikeys/ApiKeyDto';

// ── Minting ──

/** Where the dialog shows a refusal: under the field that caused it, or above the actions. */
export type MintErrorField = 'password' | 'code' | 'form';

/**
 * The field a refusal from `POST /me/api-keys` is about. The password and the
 * second-factor code are re-entered on the spot, so their refusals sit under
 * them; the per-user key limit and a rejected body are about the request as a
 * whole, as is anything unexpected.
 */
export function mintErrorField(code: string | undefined): MintErrorField {
  switch (code) {
    case 'incorrect_password':
      return 'password';
    case 'invalid_totp_code':
      return 'code';
    case 'api_key_limit_reached':
    case 'invalid_request_body':
    default:
      return 'form';
  }
}

/**
 * Refusals that never reached the server's answer: the key may have been made
 * all the same, so the list is fetched again to show it.
 */
export function mintOutcomeUnknown(code: string | undefined): boolean {
  return code === 'internet_down' || code === 'unknown_error';
}

export interface MintFailure {
  errors: Record<MintErrorField, string>;
  /** The server wants a second-factor code the profile here did not know about. */
  codeAsked: boolean;
  /** The outcome is unknown: fetch the list again, and say why at the form. */
  refetch: boolean;
}

/**
 * What a refused mint does to the form. A code refusal while the profile here
 * says there is no second factor reveals the code field and repeats the
 * message at the form, where the eye is. An unknown outcome leaves `errors.form`
 * to the caller, which explains that the key may exist.
 */
export function mintFailure(code: string | undefined, message: string, totpEnabled: boolean): MintFailure {
  const errors: Record<MintErrorField, string> = { password: '', code: '', form: '' };
  const field = mintErrorField(code);
  errors[field] = message;
  const codeAsked = field === 'code' && !totpEnabled;
  if (codeAsked) errors.form = message;
  return { errors, codeAsked, refetch: mintOutcomeUnknown(code) };
}

/** A password that is only whitespace is refused here; what is sent is never trimmed. */
export function passwordBlank(password: string): boolean {
  return password.trim().length === 0;
}

export function canSubmitMint(form: {
  name: string;
  expiresInDays: number | undefined | null;
  password: string;
  code: string;
  showCode: boolean;
}): boolean {
  return form.name.trim().length > 0
    && form.expiresInDays !== null
    && !passwordBlank(form.password)
    && (!form.showCode || form.code.trim().length > 0);
}

/** Leaving now would lose a mint in flight, or a key not yet acknowledged. */
export function mustStay(submitting: boolean, issued: boolean, acknowledged: boolean): boolean {
  return submitting || (issued && !acknowledged);
}

export type ExpiryChoice = 'never' | '30' | '90' | '365' | 'custom';

export const EXPIRY_CHOICES: readonly ExpiryChoice[] = ['never', '30', '90', '365', 'custom'];

/** The range the API accepts for `expiresInDays`. */
export const MIN_EXPIRY_DAYS = 1;
export const MAX_EXPIRY_DAYS = 3650;

/**
 * `expiresInDays` for a choice: `undefined` for a key that never expires, the
 * day count otherwise, and `null` when a custom count is not a whole number of
 * days the API would accept.
 */
export function expiryDays(choice: ExpiryChoice, custom: string): number | undefined | null {
  if (choice === 'never') return undefined;
  if (choice !== 'custom') return Number(choice);
  const trimmed = custom.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const days = Number(trimmed);
  return days >= MIN_EXPIRY_DAYS && days <= MAX_EXPIRY_DAYS ? days : null;
}

/**
 * Where a key is sent, derived from the dashboard's own API base: the public
 * tree sits beside it (`…/api/v1` → `…/api/public/v1`), and the description of
 * that tree at `<origin>/api/openapi/public/v1.json`.
 */
export function publicApiUrls(apiUrl: string | undefined, origin: string): { baseUrl: string; descriptionUrl: string } {
  const resolved = new URL(apiUrl || '/api/v1', origin);
  const path = resolved.pathname.replace(/\/+$/, '');
  const prefix = path.endsWith('/api/v1') ? path.slice(0, -'/api/v1'.length) : path.replace(/\/api$/, '');
  return {
    baseUrl: `${resolved.origin}${prefix}/api/public/v1`,
    descriptionUrl: `${resolved.origin}${prefix}/api/openapi/public/v1.json`,
  };
}

// ── Lists ──

/**
 * The page to show after a row leaves a paged list: the same page while it
 * still exists, otherwise the last one that does.
 */
export function pageAfterRemoval(page: number, totalAfter: number, pageSize: number): number {
  const lastPage = Math.max(1, Math.ceil(totalAfter / pageSize));
  return Math.min(page, lastPage);
}

/**
 * Which list a key is read in: `own` — the signed-in user's keys, across their
 * organizations (each row names its organization); `oversight` — every key
 * acting in the current organization (each row names the member it acts as).
 */
export type ApiKeyPerspective = 'own' | 'oversight';

type StateFields = Pick<ApiKeySummary, 'state' | 'createdBy'>;

/** A key whose account was erased. It can never be used again, whatever its state says. */
export function isOrphaned(key: Pick<ApiKeySummary, 'createdBy'>): boolean {
  return key.createdBy == null;
}

/** The i18n key of a key's state badge. */
export function stateLabelKey(key: StateFields): string {
  return isOrphaned(key) ? 'apiKeys.states.orphaned' : `apiKeys.states.${key.state}`;
}

/**
 * The i18n key explaining a key's state, worded for the reader: on their own
 * list the member it means is the reader. An orphaned key is only told to be
 * deleted where the reader can delete it.
 */
export function stateHintKey(key: StateFields, perspective: ApiKeyPerspective, manageable = true): string {
  if (isOrphaned(key)) return manageable ? 'apiKeys.stateHints.orphaned' : 'apiKeys.stateHints.orphanedReadOnly';
  if (key.state === 'inactive') {
    return perspective === 'own' ? 'apiKeys.stateHints.inactiveOwn' : 'apiKeys.stateHints.inactive';
  }
  if (key.state === 'active' && perspective === 'own') return 'apiKeys.stateHints.activeOwn';
  return `apiKeys.stateHints.${key.state}`;
}

/** Whether the state's explanation is written out under its badge (an active key needs none). */
export function showsStateHint(key: StateFields): boolean {
  return isOrphaned(key) || key.state !== 'active';
}

/** Ids of the rows that open a new holder's run of keys, in a list grouped by holder. */
export function groupStarts(keys: Pick<ApiKeySummary, 'id' | 'createdBy'>[]): Set<string> {
  const starts = new Set<string>();
  keys.forEach((key, index) => {
    if (index === 0 || key.createdBy !== keys[index - 1].createdBy) starts.add(key.id);
  });
  return starts;
}

/** Whom a key acts as: the erased-account label, else name, else email, else the bare id. */
export function userLabel(
  key: Pick<ApiKeySummary, 'createdBy' | 'createdByName' | 'createdByEmail'>,
  erasedLabel: string,
): string {
  if (key.createdBy == null) return erasedLabel;
  return key.createdByName || key.createdByEmail || key.createdBy;
}

/** The i18n key of the toast after a revoke or delete went through, or found the key already gone. */
export function actionToastKey(action: 'revoke' | 'delete', alreadyGone: boolean | undefined): string {
  if (alreadyGone) return 'apiKeys.goneToast';
  return action === 'revoke' ? 'apiKeys.revokedToast' : 'apiKeys.deletedToast';
}

/** One choice of the audit log's key filter. `name` is null for a key known only by its id. */
export interface AuditKeyChoice {
  id: string;
  name: string | null;
  prefix: string | null;
}

/**
 * The audit log's key choices: the organization's keys, then any key the
 * entries have shown that is no longer among them (deleted, its activity still
 * logged), then the key asked for by id if neither knows it. Each key once.
 */
export function auditKeyChoices(
  keys: Pick<ApiKeySummary, 'id' | 'name' | 'prefix'>[],
  seen: ReadonlyMap<string, string | null>,
  selectedId: string | null,
): AuditKeyChoice[] {
  const choices = new Map<string, AuditKeyChoice>();
  keys.forEach(k => choices.set(k.id, { id: k.id, name: k.name, prefix: k.prefix }));
  seen.forEach((name, id) => {
    if (!choices.has(id)) choices.set(id, { id, name, prefix: null });
  });
  if (selectedId && !choices.has(selectedId)) choices.set(selectedId, { id: selectedId, name: null, prefix: null });
  return [...choices.values()];
}

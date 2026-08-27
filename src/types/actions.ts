/**
 * Standard result shapes returned by store actions. Stores never throw for
 * expected API failures — they resolve to `{ ok: false, message }` where
 * `message` is already user-facing (resolved through the error-code i18n).
 */

import type { ErrorCode } from '@/config/errors';

export interface ActionResult {
  ok: boolean;
  /** Resolved, user-facing message when `ok` is false. */
  message?: string;
  /**
   * The raw backend error code, when a caller has to branch on *which* failure
   * it was rather than just show it — a version conflict that must keep the
   * user's draft, say. Stores only set it where a caller needs it.
   */
  code?: ErrorCode;
}

export interface ActionDataResult<T> extends ActionResult {
  data?: T;
}

/** Options accepted by cached list fetches across stores. */
export interface FetchOptions {
  /** Skip the loading indicators (background/live refreshes). */
  silent?: boolean;
  /** Bypass the fetched-key cache and hit the API regardless. */
  force?: boolean;
}

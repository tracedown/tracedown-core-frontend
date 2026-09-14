import type { ErrorCode } from '@/config/errors';

/** Where a body store keeps objects: an S3-compatible bucket or a mounted directory. */
export type BodyStoreKind = 's3' | 'filesystem';

/**
 * `import` — the agent writes here and the platform copies the body into the
 * default store at ingest. `in_place` — the body stays here and is read on
 * demand; the platform never deletes from it.
 */
export type BodyStoreMode = 'import' | 'in_place';

export const BODY_STORE_KINDS: BodyStoreKind[] = ['s3', 'filesystem'];
export const BODY_STORE_MODES: BodyStoreMode[] = ['import', 'in_place'];

/** Where a store's objects live, as shared by the store list and a bootstrap token. */
export interface BodyStoreLocation {
  kind: BodyStoreKind;
  endpoint: string | null;
  region: string | null;
  bucket: string | null;
  prefix: string | null;
  rootPath: string | null;
}

/**
 * A store as the bootstrap-token response describes it (`bodyStore`) — the
 * short form: enough to print the agent's storage settings, nothing more.
 */
export interface BodyStoreSummary extends BodyStoreLocation {
  id: string;
  name: string;
  mode: BodyStoreMode;
}

/** When a store last refused a read, an import or a test probe. */
export interface BodyStoreFailure {
  /** Same vocabulary as the test probe's `error`. */
  code: string;
  /** ISO instant. */
  at: string;
}

/** One configured store from GET /body-stores. The secret is never returned. */
export interface BodyStoreView extends BodyStoreSummary {
  accessKeyId: string | null;
  hasSecret: boolean;
  /** Agents currently assigned to this store. */
  agents: number;
  /** Cleared on the next success, so a value here is a live problem. */
  lastFailure: BodyStoreFailure | null;
  createdAt: string;
  updatedAt: string;
}

/** The environment-configured default store (GET /body-stores/default), read-only. */
export interface DefaultBodyStore {
  kind: BodyStoreKind;
  bucket?: string | null;
  prefix?: string | null;
  rootPath?: string | null;
}

/**
 * Body of POST /body-stores and PUT /body-stores/{id}. On an update an omitted
 * `secretAccessKey` keeps the stored one.
 */
export interface BodyStoreRequest {
  name: string;
  kind: BodyStoreKind;
  mode: BodyStoreMode;
  endpoint?: string;
  region?: string;
  bucket?: string;
  prefix?: string;
  rootPath?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

/** Response of POST /body-stores/{id}/test. `error` is a code, not a sentence. */
export interface BodyStoreTestResult {
  ok: boolean;
  error?: string | null;
}

/** One-line location: `bucket/prefix` for a bucket, the root path for a directory. */
export function bodyStoreLocationLabel(store: {
  kind: string;
  bucket?: string | null;
  prefix?: string | null;
  rootPath?: string | null;
}): string {
  if (store.kind === 'filesystem') return store.rootPath ?? '';
  const prefix = store.prefix?.replace(/^\/+|\/+$/g, '');
  return prefix ? `${store.bucket ?? ''}/${prefix}` : (store.bucket ?? '');
}

/**
 * Outcome of a create or update. `field` names the offending field on every
 * code that carries one (`field_invalid`, `field_too_long`,
 * `body_store_name_taken`, `store_field_required`); `reason` says why the
 * value was refused when the backend gave one.
 */
export interface BodyStoreSaveResult {
  ok: boolean;
  message?: string;
  code?: ErrorCode;
  field?: string;
  reason?: string;
  data?: BodyStoreView;
}

/** What still references a store, as `body_store_in_use` reports it. */
export interface BodyStoreUsage {
  agents: number;
  tokens: number;
  /** Stored bodies still pointing at this store — only a forgetting delete clears them. */
  bodies: boolean;
}

/** Reads the in-use counts out of the error details, whatever shape they arrive in. */
export function bodyStoreUsage(details: Record<string, unknown> | undefined): BodyStoreUsage {
  const count = (value: unknown): number => {
    if (typeof value === 'number') return value;
    if (value === true) return 1;
    return 0;
  };
  const bodies = details?.bodies;
  return {
    agents: count(details?.agents),
    tokens: count(details?.tokens),
    bodies: bodies === true || (typeof bodies === 'number' && bodies > 0),
  };
}

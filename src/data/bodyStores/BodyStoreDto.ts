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

/** A store as the bootstrap-token response describes it (`bodyStore`). */
export interface BodyStoreRef extends BodyStoreLocation {
  id: string;
  name: string;
  mode: BodyStoreMode;
}

/** One configured store from GET /body-stores. The secret is never returned. */
export interface BodyStoreSummary extends BodyStoreRef {
  accessKeyId: string | null;
  hasSecret: boolean;
  /** Agents currently assigned to this store. */
  agents: number;
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

/** Response of POST /body-stores/{id}/test. */
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

/** Outcome of a create or update: `field` names the missing field on `store_field_required`. */
export interface BodyStoreSaveResult {
  ok: boolean;
  message?: string;
  code?: ErrorCode;
  field?: string;
  data?: BodyStoreSummary;
}

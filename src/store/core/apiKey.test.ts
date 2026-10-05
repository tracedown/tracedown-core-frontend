import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useApiKeyStore } from '@/store/core/apiKey';
import type { ApiKeySummary } from '@/data/apikeys/ApiKeyDto';
import type { Page } from '@/types/pfs';

// The transport is replaced wholesale: what is under test is which paths the
// store calls, how it reads the page envelope, and what it keeps.
const http = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('@/config/requests', () => ({ http }));

function summary(overrides: Partial<ApiKeySummary> = {}): ApiKeySummary {
  return {
    id: 'k1',
    name: 'ci',
    // Shaped like the wire: list rows carry `key: null`, prefixes are 11 characters.
    key: null,
    prefix: 'td_abcdefgh',
    access: 'read',
    state: 'active',
    organizationId: 'o1',
    organizationName: 'Acme',
    createdBy: 'u1',
    createdByName: 'Ada',
    createdByEmail: 'ada@example.com',
    lastUsedAt: null,
    expiresAt: null,
    revoked: false,
    createdAt: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

function page(items: ApiKeySummary[], extra: Partial<Page<ApiKeySummary>> = {}) {
  return { success: true, data: { items, total: items.length, page: 1, pageSize: 50, ...extra } };
}

function deferred() {
  let resolve: (value: unknown) => void = () => {};
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

const flush = () => new Promise(r => setTimeout(r, 0));

beforeEach(() => {
  setActivePinia(createPinia());
  http.get.mockReset();
  http.post.mockReset();
  http.delete.mockReset();
});

describe('own keys', () => {
  it('lists from /me/api-keys and reads the page envelope', async () => {
    http.get.mockResolvedValue(page([summary()], { total: 61, page: 2 }));
    const store = useApiKeyStore();

    const result = await store.fetchOwnKeys(2);

    expect(result.ok).toBe(true);
    expect(http.get.mock.calls[0][0]).toBe('/me/api-keys?page=2');
    expect(store.ownKeys.map(k => k.id)).toEqual(['k1']);
    expect(store.ownTotal).toBe(61);
    expect(store.ownPage).toBe(2);
  });

  it('mints at /me/api-keys, hands the key back, and refetches page one without it', async () => {
    http.get.mockResolvedValueOnce(page([summary({ id: 'old' })], { page: 2, total: 51 }));
    http.post.mockResolvedValue({ success: true, data: summary({ id: 'new', key: 'td_secret' }) });
    http.get.mockResolvedValueOnce(page([summary({ id: 'new', key: null }), summary({ id: 'old' })], { total: 52 }));
    const store = useApiKeyStore();
    await store.fetchOwnKeys(2);

    const request = { name: 'ci', access: 'write' as const, password: 'pw', code: '123456', expiresInDays: 30 };
    const result = await store.createOwnKey(request);
    await vi.waitFor(() => expect(store.ownPage).toBe(1));

    expect(http.post).toHaveBeenCalledWith('/me/api-keys', request);
    expect(http.get.mock.calls[1][0]).toBe('/me/api-keys');
    expect(result.data?.key).toBe('td_secret');
    expect(store.ownKeys.map(k => k.id)).toEqual(['new', 'old']);
    expect(store.ownKeys[0]).not.toHaveProperty('key');
    expect(JSON.stringify(store.$state)).not.toContain('td_secret');
    expect(store.ownTotal).toBe(52);
  });

  it('never keeps a key a list response carries', async () => {
    http.get.mockResolvedValue(page([summary({ key: 'td_leaked' })]));
    const store = useApiKeyStore();
    await store.fetchOwnKeys();
    expect(store.ownKeys[0]).not.toHaveProperty('key');
  });

  it('returns the error code of a refused mint, and keeps the list as it was', async () => {
    http.post.mockResolvedValue({
      success: false,
      errorInfo: { code: 'incorrect_password', message: 'Incorrect password.' },
    });
    const store = useApiKeyStore();

    const result = await store.createOwnKey({ name: 'ci', access: 'read', password: 'nope' });

    expect(result).toEqual({ ok: false, message: 'Incorrect password.', code: 'incorrect_password' });
    expect(store.ownKeys).toEqual([]);
    expect(store.ownTotal).toBe(0);
  });

  it('revokes and deletes on the caller’s own paths', async () => {
    http.get.mockResolvedValue(page([summary({ id: 'a' }), summary({ id: 'b' })]));
    http.post.mockResolvedValue({ success: true, data: { ok: true } });
    http.delete.mockResolvedValue({ success: true, data: { ok: true } });
    const store = useApiKeyStore();
    await store.fetchOwnKeys();

    await store.revokeOwnKey('a');
    expect(http.post).toHaveBeenCalledWith('/me/api-keys/a/revoke', {});
    expect(store.ownKeys[0]).toMatchObject({ id: 'a', revoked: true, state: 'revoked' });

    http.get.mockResolvedValue(page([summary({ id: 'a', revoked: true, state: 'revoked' })]));
    await store.deleteOwnKey('b');
    expect(http.delete).toHaveBeenCalledWith('/me/api-keys/b');
    await vi.waitFor(() => expect(http.get).toHaveBeenCalledTimes(2));
    expect(store.ownKeys.map(k => k.id)).toEqual(['a']);
    expect(store.ownTotal).toBe(1);
  });

  it('after deleting the last row of a page, shows the page before it', async () => {
    http.get.mockResolvedValueOnce(page([summary({ id: 'z' })], { page: 2, total: 51 }));
    http.delete.mockResolvedValue({ success: true, data: { ok: true } });
    http.get.mockResolvedValueOnce(page([summary({ id: 'a' })], { page: 1, total: 50 }));
    const store = useApiKeyStore();
    await store.fetchOwnKeys(2);

    await store.deleteOwnKey('z');
    await vi.waitFor(() => expect(http.get).toHaveBeenCalledTimes(2));
    expect(http.get.mock.calls[1][0]).toBe('/me/api-keys');
    await vi.waitFor(() => expect(store.ownPage).toBe(1));
  });

  it('reports a key as already gone only once the refetched list no longer has it', async () => {
    http.get
      .mockResolvedValueOnce(page([summary({ id: 'a' }), summary({ id: 'b' })]))
      .mockResolvedValueOnce(page([summary({ id: 'b' })]));
    http.post.mockResolvedValue({ success: false, errorInfo: { code: 'not_found', message: 'gone' } });
    const store = useApiKeyStore();
    await store.fetchOwnKeys();

    const result = await store.revokeOwnKey('a');

    expect(result).toEqual({ ok: true, alreadyGone: true });
    expect(http.get).toHaveBeenCalledTimes(2);
    expect(store.ownKeys.map(k => k.id)).toEqual(['b']);
  });

  it('reports a failure when the refetched list still has a key the server called not found', async () => {
    http.get.mockResolvedValue(page([summary({ id: 'a' }), summary({ id: 'b' })]));
    http.delete.mockResolvedValue({ success: false, errorInfo: { code: 'not_found', message: 'gone' } });
    const store = useApiKeyStore();
    await store.fetchOwnKeys();

    const result = await store.deleteOwnKey('a');

    expect(result).toEqual({ ok: false, code: 'not_found' });
    expect(store.ownKeys.map(k => k.id)).toEqual(['a', 'b']);
  });

  it('does not refetch after a delete the server refused', async () => {
    http.get.mockResolvedValue(page([summary()]));
    http.delete.mockResolvedValue({ success: false, errorInfo: { code: 'forbidden', message: 'no' } });
    const store = useApiKeyStore();
    await store.fetchOwnKeys();

    const result = await store.deleteOwnKey('k1');
    await flush();

    expect(result.ok).toBe(false);
    expect(http.get).toHaveBeenCalledTimes(1);
    expect(store.ownKeys.map(k => k.id)).toEqual(['k1']);
  });

  it('refetches after a delete whose outcome is unknown, and keeps the row meanwhile', async () => {
    http.get.mockResolvedValue(page([summary()]));
    http.delete.mockResolvedValue({ success: false, errorInfo: { code: 'internet_down', message: 'offline' } });
    const store = useApiKeyStore();
    await store.fetchOwnKeys();

    const result = await store.deleteOwnKey('k1');

    expect(result).toEqual({ ok: false, message: 'offline', code: 'internet_down' });
    expect(store.ownKeys.map(k => k.id)).toEqual(['k1']);
    await vi.waitFor(() => expect(http.get).toHaveBeenCalledTimes(2));
  });

  it('ignores an answer to an earlier request that arrives late', async () => {
    let answerFirst: (value: unknown) => void = () => {};
    http.get
      .mockReturnValueOnce(new Promise((resolve) => { answerFirst = resolve; }))
      .mockResolvedValueOnce(page([summary({ id: 'second' })], { page: 2 }));
    const store = useApiKeyStore();

    const first = store.fetchOwnKeys(1);
    await store.fetchOwnKeys(2);
    answerFirst(page([summary({ id: 'first' })]));
    await first;

    expect(store.ownKeys.map(k => k.id)).toEqual(['second']);
    expect(store.ownPage).toBe(2);
    expect(store.ownLoading).toBe(false);
  });

  it('keeps the rows and records the error when a fetch fails, until one succeeds', async () => {
    http.get
      .mockResolvedValueOnce(page([summary()]))
      .mockResolvedValueOnce({ success: false, errorInfo: { code: 'internal_error', message: 'boom' } })
      .mockResolvedValueOnce(page([summary({ id: 'k2' })]));
    const store = useApiKeyStore();
    await store.fetchOwnKeys();

    const result = await store.fetchOwnKeys();

    expect(result).toEqual({ ok: false, message: 'boom' });
    expect(store.ownKeys.map(k => k.id)).toEqual(['k1']);
    expect(store.ownError).toBe('boom');

    await store.fetchOwnKeys();
    expect(store.ownError).toBeNull();
    expect(store.ownKeys.map(k => k.id)).toEqual(['k2']);
  });

  it('holds loading while the latest fetch is out, whatever an earlier one does', async () => {
    const first = deferred();
    const second = deferred();
    http.get.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const store = useApiKeyStore();

    const p1 = store.fetchOwnKeys(1);
    expect(store.ownLoading).toBe(true);
    const p2 = store.fetchOwnKeys(2);
    first.resolve(page([]));
    await p1;
    expect(store.ownLoading).toBe(true);
    second.resolve(page([summary()], { page: 2 }));
    await p2;
    expect(store.ownLoading).toBe(false);
  });

  it('forgets everything on clear, filters and pages included', async () => {
    http.get.mockResolvedValue(page([summary()], { page: 3 }));
    const store = useApiKeyStore();
    await store.fetchOwnKeys(3);
    await store.fetchOrgKeys(3, { userId: 'u9' });

    store.clear();

    expect(store.ownKeys).toEqual([]);
    expect(store.orgKeys).toEqual([]);
    expect(store.ownTotal).toBe(0);
    expect(store.orgTotal).toBe(0);
    expect(store.ownPage).toBe(1);
    expect(store.orgPage).toBe(1);
    expect(store.ownLoading).toBe(false);
    expect(store.orgLoading).toBe(false);
    expect(store.ownError).toBeNull();
    await store.fetchOrgKeys();
    expect(http.get.mock.calls.at(-1)?.[0]).toBe('/api-keys');
  });

  it('never writes back a fetch that was in flight at clear()', async () => {
    const own = deferred();
    const org = deferred();
    http.get.mockReturnValueOnce(own.promise).mockReturnValueOnce(org.promise);
    const store = useApiKeyStore();

    const p1 = store.fetchOwnKeys();
    const p2 = store.fetchOrgKeys();
    store.clear();
    own.resolve(page([summary({ id: 'prev' })]));
    org.resolve(page([summary({ id: 'prev' })]));
    await Promise.all([p1, p2]);

    expect(store.ownKeys).toEqual([]);
    expect(store.orgKeys).toEqual([]);
    expect(store.ownLoading).toBe(false);
  });
});

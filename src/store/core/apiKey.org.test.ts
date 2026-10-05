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

/** Decoded `filters` query parameter of a request path. */
function filtersOf(path: string): unknown {
  const raw = new URL(path, 'http://x').searchParams.get('filters');
  return raw ? JSON.parse(raw) : null;
}

beforeEach(() => {
  setActivePinia(createPinia());
  http.get.mockReset();
  http.post.mockReset();
  http.delete.mockReset();
});

describe('organization keys', () => {
  it('lists from /api-keys, filtered by user when asked', async () => {
    http.get.mockResolvedValue(page([summary()]));
    const store = useApiKeyStore();

    await store.fetchOrgKeys();
    expect(http.get.mock.calls[0][0]).toBe('/api-keys');

    await store.fetchOrgKeys(1, { userId: 'u9' });
    const path = http.get.mock.calls[1][0] as string;
    expect(path.startsWith('/api-keys?')).toBe(true);
    expect(filtersOf(path)).toEqual([{ table: 'api_keys', column: 'created_by', operator: 'eq', value: 'u9' }]);

    // Paging keeps the filter it was last asked for.
    await store.fetchOrgKeys(2);
    expect(filtersOf(http.get.mock.calls[2][0] as string)).toEqual(filtersOf(path));
  });

  it('revokes and deletes on the organization paths, and updates your own list too', async () => {
    http.get
      .mockResolvedValueOnce(page([summary({ id: 'a' })]))
      .mockResolvedValueOnce(page([summary({ id: 'a' }), summary({ id: 'c', createdBy: 'u2' })]));
    http.post.mockResolvedValue({ success: true, data: { ok: true } });
    http.delete.mockResolvedValue({ success: true, data: { ok: true } });
    const store = useApiKeyStore();
    await store.fetchOwnKeys();
    await store.fetchOrgKeys();

    await store.revokeOrgKey('a');
    expect(http.post).toHaveBeenCalledWith('/api-keys/a/revoke', {});
    expect(store.ownKeys[0].state).toBe('revoked');
    expect(store.orgKeys[0].state).toBe('revoked');

    http.get.mockResolvedValueOnce(page([summary({ id: 'c', createdBy: 'u2' })]));
    await store.deleteOrgKey('a');
    expect(http.delete).toHaveBeenCalledWith('/api-keys/a');
    expect(store.ownKeys).toEqual([]);
    expect(store.orgKeys.map(k => k.id)).toEqual(['c']);
    await vi.waitFor(() => expect(http.get).toHaveBeenCalledTimes(3));
    expect(http.get.mock.calls[2][0]).toBe('/api-keys');
  });

  it('pages through the key picker 100 at a time until it has every key', async () => {
    const first = Array.from({ length: 100 }, (_, i) => summary({ id: `a${i}` }));
    http.get
      .mockResolvedValueOnce(page(first, { total: 101, pageSize: 100 }))
      .mockResolvedValueOnce(page([summary({ id: 'last' })], { total: 101, page: 2, pageSize: 100 }));
    const store = useApiKeyStore();

    const result = await store.fetchOrgKeyChoices();

    expect(result.data).toHaveLength(101);
    expect(http.get.mock.calls.map(call => call[0])).toEqual([
      '/api-keys?pageSize=100',
      '/api-keys?page=2&pageSize=100',
    ]);
    expect(store.orgKeys).toEqual([]);
  });

  it('never calls the old /apikeys path', async () => {
    http.get.mockResolvedValue(page([]));
    http.post.mockResolvedValue({ success: true, data: summary({ key: 'td_x' }) });
    http.delete.mockResolvedValue({ success: true, data: { ok: true } });
    const store = useApiKeyStore();
    await store.fetchOwnKeys();
    await store.fetchOrgKeys();
    await store.fetchOrgKeyChoices();
    await store.createOwnKey({ name: 'n', access: 'read', password: 'p' });
    await store.revokeOrgKey('x');
    await store.deleteOwnKey('x');

    const paths = [...http.get.mock.calls, ...http.post.mock.calls, ...http.delete.mock.calls]
      .map(call => call[0] as string);
    expect(paths.some(p => p.includes('/apikeys'))).toBe(false);
  });

  it('lists with a prefix search, trimmed and capped at the characters a key shows', async () => {
    http.get.mockResolvedValue(page([]));
    const store = useApiKeyStore();

    await store.fetchOrgKeys(1, { prefix: '  td_abcdefghXYZ ' });

    expect(filtersOf(http.get.mock.calls[0][0] as string)).toEqual([
      { table: 'api_keys', column: 'key_prefix', operator: 'like', value: 'td_abcdefgh' },
    ]);
  });

  it('reads the page envelope and strips any key from the rows', async () => {
    http.get.mockResolvedValue(page([summary({ key: 'td_leak' })], { total: 61, page: 2 }));
    const store = useApiKeyStore();

    await store.fetchOrgKeys(2);

    expect(store.orgPage).toBe(2);
    expect(store.orgTotal).toBe(61);
    expect(store.orgKeys[0]).not.toHaveProperty('key');
  });

  it('keeps the rows and records the error when a fetch fails', async () => {
    http.get.mockResolvedValueOnce(page([summary()]))
      .mockResolvedValueOnce({ success: false, errorInfo: { code: 'internal_error', message: 'boom' } });
    const store = useApiKeyStore();
    await store.fetchOrgKeys();

    expect(await store.fetchOrgKeys()).toEqual({ ok: false, message: 'boom' });
    expect(store.orgKeys.map(k => k.id)).toEqual(['k1']);
    expect(store.orgTotal).toBe(1);
    expect(store.orgError).toBe('boom');
  });

  it('ignores a late answer, and keeps loading on until the latest lands', async () => {
    const first = deferred();
    const second = deferred();
    http.get.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const store = useApiKeyStore();

    const p1 = store.fetchOrgKeys(1);
    expect(store.orgLoading).toBe(true);
    const p2 = store.fetchOrgKeys(2);
    first.resolve(page([summary({ id: 'first' })]));
    await p1;
    expect(store.orgLoading).toBe(true);
    second.resolve(page([summary({ id: 'second' })], { page: 2 }));
    await p2;

    expect(store.orgKeys.map(k => k.id)).toEqual(['second']);
    expect(store.orgPage).toBe(2);
    expect(store.orgLoading).toBe(false);
  });

  it('after deleting the last row of page 2, shows page 1', async () => {
    http.get.mockResolvedValueOnce(page([summary({ id: 'z' })], { page: 2, total: 51 }));
    http.delete.mockResolvedValue({ success: true, data: { ok: true } });
    http.get.mockResolvedValueOnce(page([summary({ id: 'a' })], { page: 1, total: 50 }));
    const store = useApiKeyStore();
    await store.fetchOrgKeys(2);

    await store.deleteOrgKey('z');

    await vi.waitFor(() => expect(http.get).toHaveBeenCalledTimes(2));
    expect(http.get.mock.calls[1][0]).toBe('/api-keys');
    await vi.waitFor(() => expect(store.orgPage).toBe(1));
  });

  it('drops a deleted row and its count before the refetch lands', async () => {
    http.get.mockResolvedValueOnce(page([summary({ id: 'a' }), summary({ id: 'c' })]));
    http.delete.mockResolvedValue({ success: true, data: { ok: true } });
    const refetch = deferred();
    http.get.mockReturnValueOnce(refetch.promise);
    const store = useApiKeyStore();
    await store.fetchOrgKeys();

    await store.deleteOrgKey('a');

    expect(store.orgKeys.map(k => k.id)).toEqual(['c']);
    expect(store.orgTotal).toBe(1);
    refetch.resolve(page([summary({ id: 'c' })]));
  });

  it('leaves your own count alone when the deleted key was not in your list', async () => {
    http.get.mockResolvedValueOnce(page([summary({ id: 'mine' })], { total: 7 }));
    http.get.mockResolvedValueOnce(page([summary({ id: 'theirs', createdBy: 'u2' })]));
    http.delete.mockResolvedValue({ success: true, data: { ok: true } });
    http.get.mockReturnValueOnce(deferred().promise);
    const store = useApiKeyStore();
    await store.fetchOwnKeys();
    await store.fetchOrgKeys();

    await store.deleteOrgKey('theirs');

    expect(store.ownTotal).toBe(7);
  });
});

describe('key picker', () => {
  it('strips any key from the choices', async () => {
    http.get.mockResolvedValue(page([summary({ key: 'td_leak' })]));
    const result = await useApiKeyStore().fetchOrgKeyChoices();
    expect(result.data?.[0]).not.toHaveProperty('key');
  });

  it('stops on an empty page even if the total says there are more', async () => {
    http.get
      .mockResolvedValueOnce(page([summary()], { total: 150, pageSize: 100 }))
      .mockResolvedValueOnce(page([], { total: 150, page: 2, pageSize: 100 }))
      .mockResolvedValue({ success: false, errorInfo: { code: 'internal_error', message: 'loop' } });
    const result = await useApiKeyStore().fetchOrgKeyChoices();
    expect(result).toEqual({ ok: true, data: [expect.objectContaining({ id: 'k1' })] });
    expect(http.get).toHaveBeenCalledTimes(2);
  });

  it('reports a failed page rather than a partial list', async () => {
    http.get
      .mockResolvedValueOnce(page([summary()], { total: 150, pageSize: 100 }))
      .mockResolvedValueOnce({ success: false, errorInfo: { code: 'internal_error', message: 'boom' } });
    const result = await useApiKeyStore().fetchOrgKeyChoices();
    expect(result).toEqual({ ok: false, message: 'boom' });
  });

  it('never drives the global loading bar', async () => {
    const first = Array.from({ length: 100 }, (_, i) => summary({ id: `a${i}` }));
    http.get
      .mockResolvedValueOnce(page(first, { total: 101, pageSize: 100 }))
      .mockResolvedValueOnce(page([summary({ id: 'last' })], { total: 101, page: 2, pageSize: 100 }));
    await useApiKeyStore().fetchOrgKeyChoices();
    expect(http.get.mock.calls.map(call => call[1])).toEqual([{ disableLoading: true }, { disableLoading: true }]);
  });
});


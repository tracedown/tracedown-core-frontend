import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ANY_API_KEY, useAuditStore } from '@/store/core/audit';

const http = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/config/requests', () => ({ http }));

/** Decoded `filters` query parameter of the last request. */
function lastFilters(): unknown {
  const path = http.get.mock.calls.at(-1)?.[0] as string;
  const raw = new URL(path, 'http://x').searchParams.get('filters');
  return raw ? JSON.parse(raw) : null;
}

beforeEach(() => {
  setActivePinia(createPinia());
  http.get.mockReset();
  http.get.mockResolvedValue({ success: true, data: { items: [], total: 0, page: 1, pageSize: 50 } });
});

describe('audit log key filter', () => {
  it('filters on one key by id', async () => {
    await useAuditStore().fetchEntries(1, { apiKeyId: 'k1' });
    expect(lastFilters()).toEqual([{ table: 'org_audit_log', column: 'api_key_id', operator: 'eq', value: 'k1' }]);
  });

  it('filters on any key as a non-null key id', async () => {
    await useAuditStore().fetchEntries(1, { apiKeyId: ANY_API_KEY });
    expect(lastFilters()).toEqual([{ table: 'org_audit_log', column: 'api_key_id', operator: 'notNull', value: '' }]);
  });

  it('adds no key filter when none is chosen', async () => {
    await useAuditStore().fetchEntries(1, {});
    expect(lastFilters()).toBeNull();
  });
});

describe('audit log paging and races', () => {
  it('keeps the key filter when paging', async () => {
    const store = useAuditStore();
    await store.fetchEntries(1, { apiKeyId: 'k1' });
    await store.fetchEntries(2);
    expect(lastFilters()).toEqual([{ table: 'org_audit_log', column: 'api_key_id', operator: 'eq', value: 'k1' }]);
  });

  it('combines the key filter with the actor filter', async () => {
    await useAuditStore().fetchEntries(1, { actorUserId: 'u1', apiKeyId: ANY_API_KEY });
    expect(lastFilters()).toEqual([
      { table: 'org_audit_log', column: 'user_id', operator: 'eq', value: 'u1' },
      { table: 'org_audit_log', column: 'api_key_id', operator: 'notNull', value: '' },
    ]);
  });

  it('ignores an answer to an earlier request that arrives late', async () => {
    let answerFirst: (value: unknown) => void = () => {};
    const entry = (id: string) => ({
      id, userId: null, actorName: null, actorEmail: null, action: 'a', entityType: null,
      entityId: null, entityDisplayName: null, diff: null, comment: null, createdAt: '2026-10-01T00:00:00Z',
    });
    http.get
      .mockReturnValueOnce(new Promise((resolve) => { answerFirst = resolve; }))
      .mockResolvedValueOnce({ success: true, data: { items: [entry('second')], total: 60, page: 2, pageSize: 50 } });
    const store = useAuditStore();

    const first = store.fetchEntries(1);
    await store.fetchEntries(2);
    answerFirst({ success: true, data: { items: [entry('first')], total: 60, page: 1, pageSize: 50 } });
    await first;

    expect(store.entries.map(e => e.id)).toEqual(['second']);
    expect(store.page).toBe(2);
    expect(store.loading).toBe(false);
  });

  it('forgets entries and filters on clear', async () => {
    const store = useAuditStore();
    await store.fetchEntries(1, { apiKeyId: 'k1' });
    store.clear();
    expect(store.entries).toEqual([]);
    await store.fetchEntries(1);
    expect(lastFilters()).toBeNull();
  });
});

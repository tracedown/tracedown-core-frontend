import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { UserSummary } from '@/data/user/UserDto';

/**
 * The parts of the auth store a host-established session leans on: the token
 * a host hands over must become the store's own (so logout revokes it), and
 * `hasPassword` must read an older server's silence as "has one".
 */

const { httpMock, initSession } = vi.hoisted(() => ({
  httpMock: { get: vi.fn(), post: vi.fn(), delete: vi.fn(), patch: vi.fn() },
  initSession: vi.fn(async () => true),
}));
vi.mock('@/config/requests', () => ({ http: httpMock, bulk: vi.fn() }));
vi.mock('@/composables/useSessionInit', () => ({ initSession }));

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
});

const { useAuthStore } = await import('@/store/core/auth');
const { establishSession } = await import('@/app/session');
const { usePasswordSetupLink } = await import('@/composables/usePasswordSetupLink');

function user(extra: Partial<UserSummary> = {}): UserSummary {
  return {
    id: 'u1', email: 'ana@example.com', displayName: 'Ana', totpEnabled: false, selectedOrgId: null, ...extra,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  storage.clear();
  vi.clearAllMocks();
  httpMock.delete.mockResolvedValue({ success: true });
  httpMock.post.mockResolvedValue({ success: true, data: { ok: true } });
});

describe('establishSession', () => {
  it('makes the handed-over token the store\'s own, then restores the session', async () => {
    // The store exists before the hand-over, as it does in the app — reading
    // storage at creation time would hide a token written only to storage.
    const auth = useAuthStore();

    const ok = await establishSession('tok_host');

    expect(ok).toBe(true);
    expect(initSession).toHaveBeenCalledTimes(1);
    expect(auth.token).toBe('tok_host');
    expect(auth.isAuthenticated).toBe(true);
    expect(storage.get('tracedown_token')).toBe('tok_host');
  });

  it('lets logout revoke that session on the server', async () => {
    const auth = useAuthStore();
    await establishSession('tok_host');

    auth.logout();

    // `delete(url, body?, opts?)`: the options must be the third argument, or
    // they go out as the JSON body and the revoke carries no bearer.
    expect(httpMock.delete).toHaveBeenCalledTimes(1);
    const [url, body, opts] = httpMock.delete.mock.calls[0] as unknown[];
    expect(url).toBe('/auth/logout');
    expect(body).toBeUndefined();
    expect(opts).toEqual(expect.objectContaining({
      suppressUnauthorized: true,
      headers: { Authorization: 'Bearer tok_host' },
    }));
    expect(storage.has('tracedown_token')).toBe(false);
  });

  it('reports a failed restore', async () => {
    initSession.mockResolvedValueOnce(false);

    expect(await establishSession('tok_dead')).toBe(false);
  });
});

describe('hasPassword', () => {
  it('is false only when the server says so', () => {
    const auth = useAuthStore();

    auth.user = user({ hasPassword: false });
    expect(auth.hasPassword).toBe(false);

    auth.user = user({ hasPassword: true });
    expect(auth.hasPassword).toBe(true);
  });

  it('reads a field an older server omits as true', () => {
    const auth = useAuthStore();
    auth.user = user();

    expect(auth.hasPassword).toBe(true);
  });
});

describe('usePasswordSetupLink', () => {
  it('sends one link to the session user and holds back another', async () => {
    useAuthStore().user = user({ email: 'one@example.com', hasPassword: false });
    const link = usePasswordSetupLink();

    expect(link.sent.value).toBe(false);
    expect((await link.send()).ok).toBe(true);
    expect(httpMock.post).toHaveBeenCalledWith('/auth/password-reset', { email: 'one@example.com' });
    expect(link.sent.value).toBe(true);
    // Every other place on the page sees it too.
    expect(usePasswordSetupLink().sent.value).toBe(true);

    await link.send();
    expect(httpMock.post).toHaveBeenCalledTimes(1);
  });

  it('offers another link only after a minute, and then sends it', async () => {
    vi.useFakeTimers();
    try {
      useAuthStore().user = user({ email: 'five@example.com', hasPassword: false });
      const link = usePasswordSetupLink();
      await link.send();
      expect(link.canResend.value).toBe(false);

      vi.advanceTimersByTime(59_000);
      expect(link.canResend.value).toBe(false);
      expect((await link.send()).ok).toBe(false);
      expect(httpMock.post).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1_000);
      expect(link.canResend.value).toBe(true);
      expect((await link.send()).ok).toBe(true);
      expect(httpMock.post).toHaveBeenCalledTimes(2);
      // The second link restarts the wait.
      expect(link.canResend.value).toBe(false);
      expect(link.sent.value).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts afresh for a different user on the same page', async () => {
    useAuthStore().user = user({ email: 'two@example.com', hasPassword: false });
    const link = usePasswordSetupLink();
    await link.send();

    useAuthStore().user = user({ email: 'three@example.com', hasPassword: false });

    expect(link.sent.value).toBe(false);
  });

  it('does not mark a refused request as sent', async () => {
    httpMock.post.mockResolvedValueOnce({ success: false, errorInfo: { code: 'too_many_requests', message: 'Slow down.' } });
    useAuthStore().user = user({ email: 'four@example.com', hasPassword: false });
    const link = usePasswordSetupLink();

    expect(await link.send()).toEqual({ ok: false, message: 'Slow down.' });
    expect(link.sent.value).toBe(false);
  });
});

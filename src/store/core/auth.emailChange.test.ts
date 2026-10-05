import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { UserSummary } from '@/data/user/UserDto';

// The store talks to the API only through `http`, and to storage only through
// tokenStorage — both are stubbed so the cases run without a browser or server.
const post = vi.fn();
vi.mock('@/config/requests', () => ({ http: { post } }));

let storedToken: string | null = null;
vi.mock('@/utils/tokenStorage', () => ({
  getStoredToken: () => storedToken,
  setStoredToken: (value: string) => { storedToken = value; },
  clearStoredToken: () => { storedToken = null; },
}));

const { useAuthStore } = await import('@/store/core/auth');

const signedInUser = { id: 'u1', email: 'old@example.com', displayName: 'Ada' } as UserSummary;

function signedInStore() {
  storedToken = 'session-token';
  const store = useAuthStore();
  store.user = { ...signedInUser };
  return store;
}

beforeEach(() => {
  setActivePinia(createPinia());
  post.mockReset();
  storedToken = null;
});

describe('changeEmail', () => {
  it('hands back the pending request and leaves the session user alone', async () => {
    post.mockResolvedValue({
      success: true,
      data: { newEmail: 'new@example.com', expiresAt: '2026-10-03T12:00:00Z' },
    });
    const store = signedInStore();

    const result = await store.changeEmail('new@example.com', 'hunter2', '123456');

    expect(post).toHaveBeenCalledWith('/me/email', {
      newEmail: 'new@example.com',
      currentPassword: 'hunter2',
      code: '123456',
    });
    expect(result).toEqual({
      ok: true,
      data: { newEmail: 'new@example.com', expiresAt: '2026-10-03T12:00:00Z' },
    });
    expect(store.user?.email).toBe('old@example.com');
    expect(store.token).toBe('session-token');
  });

  it('passes the error code through, so a rate-limited repeat can be told apart', async () => {
    post.mockResolvedValue({
      success: false,
      errorInfo: { code: 'rate_limited', message: 'Too many requests.' },
    });
    const store = signedInStore();

    const result = await store.changeEmail('new@example.com', 'hunter2');

    expect(result).toEqual({ ok: false, code: 'rate_limited', message: 'Too many requests.' });
    expect(store.user?.email).toBe('old@example.com');
  });
});

describe('confirmEmailChange', () => {
  it('drops the local session once the server has signed every session out', async () => {
    post.mockResolvedValue({ success: true, data: { email: 'new@example.com' } });
    const store = signedInStore();

    const result = await store.confirmEmailChange('link-token');

    expect(post).toHaveBeenCalledWith('/me/email/confirm', { token: 'link-token' });
    expect(result).toEqual({ ok: true, data: { email: 'new@example.com' } });
    expect(store.token).toBeNull();
    expect(store.user).toBeNull();
    expect(storedToken).toBeNull();
  });

  it('passes the error code through and keeps the session', async () => {
    post.mockResolvedValue({
      success: false,
      errorInfo: { code: 'invalid_token', message: 'Your session has expired.' },
    });
    const store = signedInStore();

    const result = await store.confirmEmailChange('spent-token');

    expect(result).toEqual({ ok: false, code: 'invalid_token', message: 'Your session has expired.' });
    expect(store.token).toBe('session-token');
    expect(storedToken).toBe('session-token');
  });
});

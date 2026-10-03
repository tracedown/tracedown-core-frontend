import { beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { useApiKeyMint } from '@/composables/useApiKeyMint';
import { useAuthStore } from '@/store/core/auth';
import type { UserSummary } from '@/data/user/UserDto';

// The auth store reads the stored session token at creation; node has no
// storage, so a map stands in before any module loads.
vi.hoisted(() => {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => map.clear(),
  };
  (globalThis as Record<string, unknown>).localStorage = storage;
  (globalThis as Record<string, unknown>).sessionStorage = storage;
});
const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock('@/config/requests', () => ({ http }));
// Messages come back as their keys, so assertions name what was chosen.
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }));

const emptyPage = { success: true, data: { items: [], total: 0, page: 1, pageSize: 50 } };

function mint() {
  const scope = effectScope();
  const form = scope.run(() => useApiKeyMint('name-input'));
  if (!form) throw new Error('no scope');
  return form;
}

beforeEach(() => {
  setActivePinia(createPinia());
  http.get.mockReset();
  http.post.mockReset();
  http.get.mockResolvedValue(emptyPage);
});

describe('useApiKeyMint', () => {
  it('reveals the code field after a code refusal the profile did not expect, and says so at the form', async () => {
    http.post.mockResolvedValue({ success: false, errorInfo: { code: 'invalid_totp_code', message: 'Code needed' } });
    const form = mint();
    form.name.value = 'ci';
    form.password.value = 'pw';
    await nextTick();
    expect(form.showCode.value).toBe(false);

    await form.submit();

    expect(form.showCode.value).toBe(true);
    expect(form.errors.code).toBe('Code needed');
    expect(form.errors.form).toBe('Code needed');
    expect(form.canSubmit.value).toBe(false);
  });

  it('sends a typed code even when the profile says there is no second factor', async () => {
    http.post.mockResolvedValue({ success: false, errorInfo: { code: 'invalid_totp_code', message: 'x' } });
    const form = mint();
    form.name.value = 'ci';
    form.password.value = 'pw';
    await form.submit();
    form.code.value = ' 123456 ';
    http.post.mockResolvedValue({ success: true, data: { id: 'k', key: 'td_x' } });

    await form.submit();

    expect(http.post.mock.calls[1][1]).toMatchObject({ code: '123456' });
  });

  it('retracts a field error once the field is edited', async () => {
    http.post.mockResolvedValue({ success: false, errorInfo: { code: 'incorrect_password', message: 'Wrong' } });
    const form = mint();
    form.name.value = 'ci';
    form.password.value = 'pw';
    await form.submit();
    expect(form.errors.password).toBe('Wrong');

    form.password.value = 'pw2';
    await nextTick();

    expect(form.errors.password).toBe('');
  });

  it('refetches the list and explains when the outcome is unknown', async () => {
    http.post.mockResolvedValue({ success: false, errorInfo: { code: 'internet_down', message: 'offline' } });
    const form = mint();
    form.name.value = 'ci';
    form.password.value = 'pw';

    await form.submit();

    expect(form.errors.form).toBe('apiKeys.mint.outcomeUnknown');
    expect(http.get).toHaveBeenCalledWith('/me/api-keys');
  });

  it('refuses a blank password without trimming one that is sent', async () => {
    http.post.mockResolvedValue({ success: true, data: { id: 'k', key: 'td_x' } });
    const form = mint();
    form.name.value = 'ci';
    form.password.value = '   ';
    expect(form.passwordIsBlank.value).toBe(true);
    await form.submit();
    expect(http.post).not.toHaveBeenCalled();

    form.password.value = ' pw ';
    await form.submit();
    expect(http.post.mock.calls[0][1]).toMatchObject({ password: ' pw ' });
  });

  it('holds a minted key until acknowledged, and clears the secrets typed', async () => {
    http.post.mockResolvedValue({ success: true, data: { id: 'k', key: 'td_x' } });
    const form = mint();
    form.name.value = 'ci';
    form.password.value = 'pw';
    form.expiry.value = 'custom';
    form.customDays.value = '0';
    await form.submit();
    expect(http.post).not.toHaveBeenCalled();

    form.customDays.value = '30';
    await form.submit();

    expect(http.post.mock.calls[0][1]).toMatchObject({ expiresInDays: 30, password: 'pw' });
    expect(form.password.value).toBe('');
    expect(form.mustStay.value).toBe(true);
    form.acknowledged.value = true;
    expect(form.mustStay.value).toBe(false);
  });

  it('shows the code field from the start for an enrolled user', () => {
    useAuthStore().user = { totpEnabled: true } as UserSummary;
    expect(mint().showCode.value).toBe(true);
  });
});

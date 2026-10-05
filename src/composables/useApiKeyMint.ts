import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useApiKeyStore } from '@/store/core/apiKey';
import { useAuthStore } from '@/store/core/auth';
import {
  canSubmitMint, expiryDays, mintFailure, mustStay as mustStayFor, passwordBlank,
} from '@/lib/apiKeys';
import type { ExpiryChoice, MintErrorField } from '@/lib/apiKeys';
import type { ApiKeyAccess, ApiKeySummary } from '@/data/apikeys/ApiKeyDto';

/**
 * State and submission of the mint-a-key dialog, kept apart from its layout;
 * the decisions themselves are the pure functions of `lib/apiKeys`.
 * `nameInputId` is focused when the dialog opens.
 */
export function useApiKeyMint(nameInputId: string) {
  const { t } = useI18n();
  const apiKeyStore = useApiKeyStore();
  const authStore = useAuthStore();

  const name = ref<string>('');
  const access = ref<ApiKeyAccess>('read');
  const expiry = ref<ExpiryChoice>('never');
  const customDays = ref<string>('');
  const password = ref<string>('');
  const code = ref<string>('');
  const submitting = ref<boolean>(false);
  const errors = reactive<Record<MintErrorField, string>>({ password: '', code: '', form: '' });
  /** Set once the server asked for a code the profile here did not know was needed. */
  const codeAsked = ref<boolean>(false);

  const issued = ref<ApiKeySummary | null>(null);
  const acknowledged = ref<boolean>(false);
  /** Why the last close or navigation was refused. */
  const blockedMessage = ref<string>('');

  const totpEnabled = computed(() => authStore.user?.totpEnabled ?? false);
  /**
   * An account without a password (it signs in another way) cannot confirm a
   * mint: the dialog shows how to set one instead of the password and code
   * fields, and nothing can be submitted.
   */
  const hasPassword = computed(() => authStore.hasPassword);
  const showCode = computed(() => hasPassword.value && (totpEnabled.value || codeAsked.value));
  const expiresInDays = computed(() => expiryDays(expiry.value, customDays.value));
  /** Something was typed in the password field, and it is only whitespace. */
  const passwordIsBlank = computed(() => password.value.length > 0 && passwordBlank(password.value));

  const canSubmit = computed(() => hasPassword.value && canSubmitMint({
    name: name.value,
    expiresInDays: expiresInDays.value,
    password: password.value,
    code: code.value,
    showCode: showCode.value,
  }));

  /** Something typed that closing would throw away. */
  const dirty = computed(() =>
    name.value.trim() !== '' || password.value !== '' || code.value !== '' || customDays.value !== '');

  const mustStay = computed(() => mustStayFor(submitting.value, issued.value != null, acknowledged.value));

  // An error belongs to what was typed; typing again retracts it.
  watch(password, () => { errors.password = ''; });
  watch(code, () => { errors.code = ''; if (!totpEnabled.value) errors.form = ''; });
  watch([name, access, expiry, customDays], () => { errors.form = ''; });
  watch(acknowledged, (value) => { if (value) blockedMessage.value = ''; });
  watch(submitting, (value) => { if (!value && !issued.value) blockedMessage.value = ''; });

  async function submit() {
    if (submitting.value || !canSubmit.value) return;
    submitting.value = true;
    errors.password = '';
    errors.code = '';
    errors.form = '';
    try {
      const typedCode = code.value.trim();
      const result = await apiKeyStore.createOwnKey({
        name: name.value.trim(),
        access: access.value,
        expiresInDays: expiresInDays.value ?? undefined,
        // Never trimmed: a password is whatever was typed.
        password: password.value,
        code: typedCode || undefined,
      });
      if (!result.ok || !result.data) {
        const failure = mintFailure(result.code, result.message ?? t('errors.unknown_error'), totpEnabled.value);
        Object.assign(errors, failure.errors);
        if (failure.codeAsked) codeAsked.value = true;
        if (failure.refetch) {
          // The key may exist all the same; the list shows it so it can be revoked.
          errors.form = t('apiKeys.mint.outcomeUnknown');
          void apiKeyStore.fetchOwnKeys(1);
        }
        return;
      }
      password.value = '';
      code.value = '';
      issued.value = result.data;
    } finally {
      submitting.value = false;
    }
  }

  onMounted(() => {
    void nextTick(() => document.getElementById(nameInputId)?.focus());
  });

  return {
    name, access, expiry, customDays, password, code, submitting, errors,
    issued, acknowledged, blockedMessage, expiresInDays, hasPassword, showCode, canSubmit, dirty,
    passwordIsBlank, submit, mustStay,
  };
}

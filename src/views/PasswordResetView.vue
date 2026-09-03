<template>
    <div
      class="min-h-dvh bg-background-primary
             flex flex-col gap-2 items-center justify-center max-md:px-4"
    >
      <div
        class="w-full max-w-sm p-8 max-md:p-6
             bg-background-secondary rounded-tr-xl rounded-bl-xl"
      >
        <h1 class="text-3xl font-bold font-mono! text-right mb-2">
          {{ t('common.appName') }}
        </h1>

        <!-- Done: request sent or password changed -->
        <div
          v-if="done"
          class="space-y-4"
        >
          <p class="text-sm text-text-secondary">
            {{ token ? t('auth.reset.changed') : t('auth.reset.sent') }}
          </p>
          <LinkButton
            :label-text="t('nav.login')"
            @click="() => router.push({ name: 'login' })"
          />
        </div>

        <!-- Confirm phase: token from the email link -->
        <form
          v-else-if="token"
          class="space-y-4"
          @submit.prevent="handleConfirm"
        >
          <p class="text-sm text-text-secondary">
            {{ t('auth.reset.confirmHint') }}
          </p>

          <LabeledInput
            id="newPassword"
            v-model="newPassword"
            :label="t('auth.reset.newPassword')"
            name="newPassword"
            type="password"
            autocomplete="new-password"
            :placeholder="t('auth.reset.newPassword')"
            required
          />
          <LabeledInput
            id="repeatPassword"
            v-model="repeatPassword"
            :label="t('auth.reset.repeatPassword')"
            name="repeatPassword"
            type="password"
            autocomplete="new-password"
            :placeholder="t('auth.reset.repeatPassword')"
            required
          />

          <p
            v-if="mismatch"
            class="text-sm text-status-warning"
          >
            {{ t('auth.reset.mismatch') }}
          </p>
          <p
            v-if="error"
            class="text-sm text-status-failure"
          >
            {{ error }}
          </p>

          <PrimaryButton
            type="submit"
            full-width
            :label-text="t('auth.reset.confirmButton')"
            :loading="submitting"
            :disabled="!newPassword || newPassword !== repeatPassword"
          />
        </form>

        <!-- Request phase: ask for the account email -->
        <form
          v-else
          class="space-y-4"
          @submit.prevent="handleRequest"
        >
          <p class="text-sm text-text-secondary">
            {{ t('auth.reset.requestHint') }}
          </p>

          <LabeledInput
            id="email"
            v-model="email"
            :label="t('auth.email')"
            name="email"
            type="email"
            autocomplete="email"
            :placeholder="t('auth.email')"
            required
          />

          <p
            v-if="error"
            class="text-sm text-status-failure"
          >
            {{ error }}
          </p>

          <PrimaryButton
            type="submit"
            full-width
            :label-text="t('auth.reset.requestButton')"
            :loading="submitting"
            :disabled="!email.trim()"
          />
          <LinkButton
            :label-text="t('nav.login')"
            @click="() => router.push({ name: 'login' })"
          />
        </form>
      </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import LabeledInput from '@/components/core/input/LabeledInput.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import LinkButton from '@/components/core/buttons/LinkButton.vue';
import { useAuthStore } from '@/store/core/auth';

/**
 * Public password-reset page (`/reset-password[/{token}]`). Without a token
 * it requests the reset email (the response never reveals whether the
 * address exists); with the token from the email link it collects the new
 * password. Token validity surfaces only on submit — there is deliberately
 * no pre-validation endpoint to probe tokens against.
 */
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const token = computed(() => (route.params.token as string | undefined) ?? null);

const email = ref<string>('');
const newPassword = ref<string>('');
const repeatPassword = ref<string>('');
const submitting = ref<boolean>(false);
const done = ref<boolean>(false);
const error = ref<string | null>(null);

const mismatch = computed(() =>
  repeatPassword.value.length > 0 && newPassword.value !== repeatPassword.value);

async function handleRequest() {
  if (submitting.value) return;
  submitting.value = true;
  error.value = null;
  try {
    const result = await authStore.requestPasswordReset(email.value.trim());
    if (!result.ok) {
      error.value = result.message ?? t('common.states.error');
      return;
    }
    done.value = true;
  } finally {
    submitting.value = false;
  }
}

async function handleConfirm() {
  if (submitting.value || !token.value) return;
  submitting.value = true;
  error.value = null;
  try {
    const result = await authStore.confirmPasswordReset(token.value, newPassword.value);
    if (!result.ok) {
      error.value = result.message ?? t('common.states.error');
      return;
    }
    done.value = true;
  } finally {
    submitting.value = false;
  }
}
</script>

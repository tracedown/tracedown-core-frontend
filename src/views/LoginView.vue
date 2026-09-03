<template>
    <div
      class="min-h-dvh bg-background-primary
             flex flex-col gap-2 items-center justify-center max-md:px-4"
    >
      <div
        class="w-full max-w-sm p-8 max-md:p-6
             bg-background-secondary rounded-tr-xl rounded-bl-xl"
      >
        <!-- The wordmark links to the root so any auth-adjacent page a host
             application adds can return to the entry point; on this view the
             router simply resolves back here. -->
        <h1 class="flex items-center justify-between text-3xl font-bold font-mono! mb-2">
          <img
            src="/logo.svg"
            :alt="t('common.appName')"
            class="h-10 w-10 shrink-0"
          >
          <RouterLink :to="{ path: '/' }">
            {{ t('common.appName') }}
          </RouterLink>
        </h1>

        <!-- Forced enrollment: the org requires TOTP and this user hasn't enrolled. -->
        <div
          v-if="phase === 'enroll'"
          class="space-y-4"
        >
          <p class="text-sm text-text-secondary">
            {{ t('auth.enrollRequired') }}
          </p>
          <Totp2faSetupForm
            :secret="enrollSecret"
            :otpauth-uri="enrollOtpauthUri"
            :recovery-codes="enrollRecoveryCodes"
            :loading="submitting"
            :error="error"
            @start="startForcedEnroll"
            @confirm="confirmForcedEnroll"
            @done="finishForcedEnroll"
          />
        </div>

        <!-- Credentials, expanding into the TOTP challenge after sign-in. -->
        <template v-else>
          <form
            class="space-y-4"
            @submit.prevent="handleLogin"
          >
            <LabeledInput
              id="email"
              v-model="email"
              :label="t('auth.email')"
              name="email"
              type="email"
              autocomplete="email"
              :placeholder="t('auth.email')"
              :disabled="phase === 'challenge'"
              required
            />

            <LabeledInput
              id="password"
              v-model="password"
              :label="t('auth.password')"
              name="password"
              type="password"
              autocomplete="current-password"
              :placeholder="t('auth.password')"
              :disabled="phase === 'challenge'"
              required
            />

            <template v-if="phase !== 'challenge'">
              <p
                v-if="error"
                class="text-status-failure text-sm"
              >
                {{ error }}
              </p>

              <PrimaryButton
                type="submit"
                full-width
                :label-text="t('auth.loginButton')"
                :loading="submitting"
                :disabled="!email || !password"
              />

              <div class="flex items-center justify-between px-2">
                <LinkButton
                  :label-text="t('auth.reset.forgot')"
                  @click="() => router.push({ name: 'password-reset' })"
                />
                <!-- Extension point: a host application can inject a sign-up link here. -->
                <SlotOutlet name="login-footer" />
              </div>
            </template>
          </form>

          <TotpChallengeForm
            v-if="phase === 'challenge'"
            class="mt-4"
            :challenge="challenge"
            @success="enterApp"
            @cancel="cancelChallenge"
          />
        </template>
      </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/core/auth';
import { useNotificationStore } from '@/store/ui/notifications';
import { initSession } from '@/composables/useSessionInit';
import LabeledInput from "@/components/core/input/LabeledInput.vue";
import PrimaryButton from "@/components/core/buttons/PrimaryButton.vue";
import LinkButton from "@/components/core/buttons/LinkButton.vue";
import Totp2faSetupForm from "@/components/core/auth/Totp2faSetupForm.vue";
import TotpChallengeForm from "@/components/core/auth/TotpChallengeForm.vue";
import SlotOutlet from "@/components/core/SlotOutlet.vue";

type Phase = 'credentials' | 'challenge' | 'enroll';

const { t } = useI18n();
const router = useRouter();
const auth = useAuthStore();
const notifications = useNotificationStore();

const phase = ref<Phase>('credentials');
const email = ref<string>('');
const password = ref<string>('');
const error = ref<string>('');
const submitting = ref<boolean>(false);

// Challenge state — the code entry itself lives in TotpChallengeForm.
const challenge = ref<string>('');

// Forced enrollment state
const setupToken = ref<string>('');
const enrollSecret = ref<string>('');
const enrollOtpauthUri = ref<string>('');
const enrollConfirmToken = ref<string>('');
const enrollRecoveryCodes = ref<string[]>([]);

async function handleLogin() {
  error.value = '';
  submitting.value = true;
  try {
    const outcome = await auth.login({ email: email.value, password: password.value });
    switch (outcome.status) {
      case 'error':
        error.value = outcome.message ?? t('errors.unknown_error');
        return;
      case 'totp_required':
        phase.value = 'challenge';
        challenge.value = outcome.challenge;
        return;
      case 'totp_setup_required':
        phase.value = 'enroll';
        setupToken.value = outcome.setupToken;
        await startForcedEnroll();
        return;
      case 'success':
        await enterApp();
    }
  } finally {
    submitting.value = false;
  }
}

/** Terminates the sign-in attempt and restores the plain login form. */
function cancelChallenge() {
  phase.value = 'credentials';
  challenge.value = '';
  error.value = '';
  password.value = '';
}

async function enterApp() {
  await initSession();
  const redirect = router.currentRoute.value.query.redirect as string | undefined;
  await router.push(redirect ?? '/');
}

async function startForcedEnroll() {
  error.value = '';
  submitting.value = true;
  try {
    const result = await auth.beginForcedTotpEnroll(setupToken.value);
    if (!result.ok || !result.data) {
      error.value = result.message ?? t('errors.unknown_error');
      return;
    }
    enrollSecret.value = result.data.secret;
    enrollOtpauthUri.value = result.data.otpauthUri;
    enrollConfirmToken.value = result.data.confirmToken;
  } finally {
    submitting.value = false;
  }
}

async function confirmForcedEnroll(enteredCode: string) {
  error.value = '';
  submitting.value = true;
  try {
    const result = await auth.confirmTotpEnroll(enrollConfirmToken.value, enteredCode);
    if (!result.ok) {
      error.value = result.message ?? t('errors.unknown_error');
      return;
    }
    enrollRecoveryCodes.value = result.recoveryCodes ?? [];
  } finally {
    submitting.value = false;
  }
}

/** Recovery codes acknowledged — drop the fresh session and require re-login. */
function finishForcedEnroll() {
  auth.logout();
  phase.value = 'credentials';
  password.value = '';
  setupToken.value = '';
  enrollSecret.value = '';
  enrollOtpauthUri.value = '';
  enrollConfirmToken.value = '';
  enrollRecoveryCodes.value = [];
  error.value = '';
  notifications.show(t('auth.reloginAfterSetup'), 'success');
}
</script>

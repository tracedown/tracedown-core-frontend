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

        <!-- Confirmed: the address changed and every session was signed out -->
        <div
          v-if="confirmedEmail"
          class="space-y-4"
        >
          <p class="text-sm text-text-secondary">
            {{ t('auth.confirmEmail.done', { email: confirmedEmail }) }}
          </p>
          <PrimaryButton
            full-width
            :label-text="t('nav.login')"
            @click="() => router.push({ name: 'login' })"
          />
        </div>

        <!-- Refused: unknown, expired, used or superseded link, or a late conflict -->
        <div
          v-else-if="error"
          class="space-y-4"
        >
          <p class="text-sm text-status-failure">
            {{ error }}
          </p>
          <LinkButton
            :label-text="t('auth.confirmEmail.back')"
            @click="() => router.push({ name: 'home' })"
          />
        </div>

        <!-- Waiting for the click: a link that acts on being opened is acted
             on by mail scanners, not people -->
        <div
          v-else
          class="space-y-4"
        >
          <p class="text-sm text-text-secondary">
            {{ t('auth.confirmEmail.intro') }}
          </p>
          <PrimaryButton
            full-width
            :label-text="submitting ? t('auth.confirmEmail.confirming') : t('auth.confirmEmail.confirm')"
            :disabled="submitting"
            @click="confirm"
          />
        </div>
      </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import LinkButton from '@/components/core/buttons/LinkButton.vue';
import { useAuthStore } from '@/store/core/auth';
import { useOrgStore } from '@/store/core/org';
import { useWorkspaceStore } from '@/store/core/workspace';

/**
 * Public email-change confirmation page (`/confirm-email/{token}`), the target
 * of the link mailed to the new address. The token is submitted on a click,
 * never on opening the page: mail security scanners open links, and a link
 * that acted on being opened would move accounts without anybody deciding to.
 * Success means the server signed out every session of the account, so the
 * local one is gone too and the only way on is to sign in again.
 */
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const orgStore = useOrgStore();
const workspaceStore = useWorkspaceStore();

const confirmedEmail = ref<string | null>(null);
const error = ref<string | null>(null);
const submitting = ref(false);

async function confirm() {
  if (submitting.value) return;
  submitting.value = true;
  try {
    const token = route.params.token as string;
    const result = await authStore.confirmEmailChange(token);
    if (!result.ok || !result.data) {
      // The global wording of invalid_token is about an expired session; here it
      // means the link itself.
      error.value = result.code === 'invalid_token'
        ? t('auth.confirmEmail.invalidToken')
        : result.message ?? t('common.states.error');
      return;
    }
    // The auth store already dropped the revoked session; the per-session data
    // the shell keeps goes with it, as on logout.
    orgStore.clear();
    workspaceStore.clear();
    confirmedEmail.value = result.data.email;
  } finally {
    submitting.value = false;
  }
}
</script>

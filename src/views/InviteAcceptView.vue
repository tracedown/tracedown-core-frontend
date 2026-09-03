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

        <!-- Loading the invite, or accepting one. -->
        <div
          v-if="loading || entering"
          class="flex flex-col items-center gap-3 py-8"
        >
          <LoadingSpinner />
          <p
            v-if="entering && invite"
            class="text-sm text-text-secondary"
          >
            {{ t('invite.joiningNow', { org: invite.orgName }) }}
          </p>
        </div>

        <!-- Invalid or expired token -->
        <div
          v-else-if="!invite"
          class="space-y-4"
        >
          <p class="text-sm text-status-failure">
            {{ t('invite.invalid') }}
          </p>
          <LinkButton
            :label-text="t('nav.login')"
            @click="() => router.push({ name: 'login' })"
          />
        </div>

        <!-- Existing account, signed in as the invitee: confirm to join. -->
        <div
          v-else-if="invite.userExists && sessionMatches"
          class="space-y-4"
        >
          <p class="text-sm text-text-secondary">
            {{ t('invite.joining', { org: invite.orgName }) }}
          </p>
          <p class="text-sm font-medium text-text-primary">
            {{ invite.email }}
          </p>
          <p
            v-if="error"
            class="text-sm text-status-failure"
          >
            {{ error }}
          </p>
          <SlotOutlet
            name="invite-consent"
            :slot-props="{ userExists: true }"
          />

          <PrimaryButton
            full-width
            :label-text="t('invite.accept')"
            :disabled="!acceptAvailable"
            :on-click="accept"
          />
        </div>

        <!-- Existing account, not signed in as the invitee: they must log in. -->
        <div
          v-else-if="invite.userExists"
          class="space-y-4"
        >
          <p class="text-sm text-text-secondary">
            {{ t('invite.loginToAccept', { email: invite.email }) }}
          </p>
          <p
            v-if="error"
            class="text-sm text-status-failure"
          >
            {{ error }}
          </p>
          <PrimaryButton
            full-width
            :label-text="t('invite.logIn')"
            :on-click="goToLogin"
          />
        </div>

        <!-- New user: set a display name + password and enter. -->
        <form
          v-else
          class="space-y-4"
          @submit.prevent="handleAcceptNew"
        >
          <p class="text-sm text-text-secondary">
            {{ t('invite.joining', { org: invite.orgName }) }}
          </p>
          <p class="text-sm font-medium text-text-primary">
            {{ invite.email }}
          </p>

          <LabeledInput
            id="displayName"
            v-model="displayName"
            :label="t('invite.displayName')"
            name="displayName"
            type="text"
            autocomplete="name"
            :placeholder="t('invite.displayName')"
            required
          />

          <LabeledInput
            id="password"
            v-model="password"
            :label="t('auth.password')"
            name="password"
            type="password"
            autocomplete="new-password"
            :placeholder="t('auth.password')"
            required
          />

          <p
            v-if="error"
            class="text-sm text-status-failure"
          >
            {{ error }}
          </p>

          <SlotOutlet
            name="invite-consent"
            :slot-props="{ userExists: false }"
          />

          <PrimaryButton
            type="submit"
            full-width
            :label-text="t('invite.accept')"
            :loading="submitting"
            :disabled="!displayName.trim() || !password || !acceptAvailable"
          />
        </form>

        <!-- Extension point: a host application can inject additional content here. -->
        <SlotOutlet name="invite-footer" />
      </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import LabeledInput from '@/components/core/input/LabeledInput.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import LinkButton from '@/components/core/buttons/LinkButton.vue';
import LoadingSpinner from '@/components/core/LoadingSpinner.vue';
import SlotOutlet from '@/components/core/SlotOutlet.vue';
import { useAuthStore } from '@/store/core/auth';
import { initSession } from '@/composables/useSessionInit';
import { isFeatureEnabled } from '@/config/extensions';
import type { InviteInfo } from '@/data/orgs/InviteDto';

/**
 * Public landing page of invite emails (`/invite/{token}`).
 *
 * - A genuinely new user sets a display name + password, which creates the
 *   account and a session.
 * - An email that already has an account never re-enters its credentials: if the
 *   invitee is already signed in it just confirms with an Accept button; otherwise
 *   it asks them to log in first (the token alone must not let anyone join as them).
 *
 * Every accepted path returns a session scoped to the joined org, so the app
 * lands there.
 */
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const token = route.params.token as string;

const loading = ref<boolean>(true);
const entering = ref<boolean>(false);
const invite = ref<InviteInfo | null>(null);
const displayName = ref<string>('');
const password = ref<string>('');
const submitting = ref<boolean>(false);
const error = ref<string | null>(null);

/**
 * Whether accepting is available right now. Un-extended this is always true —
 * the gate exists so a host application that renders something into the
 * `invite-consent` slot can require it to be satisfied before the invitee may
 * join. This view never learns what the condition is, only whether it holds.
 *
 * The slot is told whether the invitee already has an account (`userExists`),
 * because the two entries are not the same act: one is a first arrival, the
 * other is an existing user joining another org. Which of them warrants a
 * condition is the host's call, not this view's.
 */
const acceptAvailable = computed<boolean>(() => isFeatureEnabled('invite.accept'));

/** True when the current session belongs to the invited account. */
const sessionMatches = computed(() =>
  authStore.isAuthenticated &&
  !!invite.value &&
  authStore.user?.email?.toLowerCase() === invite.value.email.toLowerCase());

onMounted(async () => {
  const result = await authStore.fetchInviteInfo(token);
  invite.value = result.ok ? result.data ?? null : null;
  loading.value = false;
});

/** Finishes acceptance and enters the app (both accept paths land here). */
async function finish() {
  await initSession();
  await router.push({ name: 'home' });
}

/** Existing-account accept — no credentials, proven by the session. */
async function accept() {
  entering.value = true;
  error.value = null;
  const result = await authStore.acceptInvite(token);
  if (!result.ok) {
    error.value = result.message ?? t('common.states.error');
    entering.value = false;
    return;
  }
  await finish();
}

/** New-user accept — sets the display name + password. */
async function handleAcceptNew() {
  if (submitting.value) return;
  submitting.value = true;
  entering.value = true;
  error.value = null;
  const result = await authStore.acceptInvite(token, {
    displayName: displayName.value.trim(),
    password: password.value,
  });
  if (!result.ok) {
    error.value = result.message ?? t('common.states.error');
    submitting.value = false;
    entering.value = false;
    return;
  }
  await finish();
}

/** Sends an unauthenticated existing user to log in, returning here to accept. */
function goToLogin() {
  void router.push({ name: 'login', query: { redirect: route.fullPath } });
}
</script>

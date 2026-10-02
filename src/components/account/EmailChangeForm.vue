<template>
    <!-- Pending: a confirmation link is out, nothing has changed yet -->
    <div
      v-if="pending"
      class="space-y-3 max-w-sm"
    >
      <SectionHeading :label="t('account.emailSection')" />

      <p class="text-sm">
        {{ t('account.emailChangeSent', { email: pending.newEmail }) }}
      </p>
      <p class="text-xs text-text-secondary">
        {{ t('account.emailChangeExpiry', { time: formatDateTime(pending.expiresAt) }) }}
      </p>
      <p class="text-xs text-text-secondary">
        {{ t('account.emailChangeNotice') }}
      </p>
      <p class="text-xs text-text-secondary">
        {{ t('account.emailChangeSignOut') }}
      </p>

      <LinkButton
        :label-text="t('account.emailChangeAgain')"
        @click="startOver"
      />
    </div>

    <form
      v-else
      class="space-y-3 max-w-sm"
      @submit.prevent="handleSubmit"
    >
      <SectionHeading :label="t('account.emailSection')" />

      <LabeledInput
        id="newEmail"
        v-model="newEmail"
        :label="t('account.newEmail')"
        name="newEmail"
        type="email"
        autocomplete="email"
        :placeholder="t('account.newEmail')"
        required
      />
      <LabeledInput
        id="emailCurrentPassword"
        v-model="currentPassword"
        :label="t('account.currentPassword')"
        name="emailCurrentPassword"
        type="password"
        autocomplete="current-password"
        :placeholder="t('account.currentPassword')"
        required
      />
      <LabeledInput
        v-if="authStore.user?.totpEnabled"
        id="emailTotpCode"
        v-model="code"
        :label="t('account.totpCode')"
        name="emailTotpCode"
        type="text"
        autocomplete="one-time-code"
        :placeholder="t('account.totpCode')"
        required
      />

      <p class="text-xs text-text-secondary">
        {{ t('account.emailChangeHint') }}
      </p>

      <PrimaryButton
        type="submit"
        :label-text="t('account.changeEmail')"
        :loading="submitting"
        :disabled="!newEmail.trim() || !currentPassword || (authStore.user?.totpEnabled && !code)"
      />
    </form>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import LabeledInput from '@/components/core/input/LabeledInput.vue';
import LinkButton from '@/components/core/buttons/LinkButton.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import SectionHeading from '@/components/core/SectionHeading.vue';
import type { ChangeEmailPending } from '@/data/auth/AuthDto';
import { formatDateTime } from '@/lib/dateFormat';
import { useAuthStore } from '@/store/core/auth';
import { useNotificationStore } from '@/store/ui/notifications';

/**
 * Change-email section of the account profile tab. A successful request only
 * mails a confirmation link to the new address, so the section then shows
 * that pending state until the user starts over; the address itself changes
 * on the public confirm page.
 */
const { t } = useI18n();
const authStore = useAuthStore();
const notifications = useNotificationStore();

const newEmail = ref<string>('');
const currentPassword = ref<string>('');
const code = ref<string>('');
const submitting = ref<boolean>(false);
const pending = ref<ChangeEmailPending | null>(null);

async function handleSubmit() {
  if (submitting.value) return;
  submitting.value = true;
  try {
    const result = await authStore.changeEmail(
      newEmail.value.trim(),
      currentPassword.value,
      code.value || undefined,
    );
    if (!result.ok || !result.data) {
      const message = result.code === 'email_change_cooldown'
        ? t('errors.email_change_cooldown')
        : result.message;
      notifications.show(message ?? t('common.states.error'), 'error');
      return;
    }
    pending.value = result.data;
    newEmail.value = '';
    currentPassword.value = '';
    code.value = '';
  } finally {
    submitting.value = false;
  }
}

/** Back to an empty form, for a new link or a different address. */
function startOver() {
  pending.value = null;
}
</script>

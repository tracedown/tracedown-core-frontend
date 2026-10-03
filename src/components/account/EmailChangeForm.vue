<template>
    <form
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
        :disabled="!authStore.hasPassword"
        required
      />
      <!-- The change is confirmed with the current password; an account
           without one is offered the link that sets it instead (as a text
           link: the Password section below carries the main button). -->
      <PasswordSetupNotice
        v-if="!authStore.hasPassword"
        variant="link"
      />
      <LabeledInput
        v-else
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
        v-if="authStore.hasPassword && authStore.user?.totpEnabled"
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
        :disabled="!authStore.hasPassword || !newEmail.trim() || !currentPassword
          || (authStore.user?.totpEnabled && !code)"
      />
    </form>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import LabeledInput from '@/components/core/input/LabeledInput.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import SectionHeading from '@/components/core/SectionHeading.vue';
import PasswordSetupNotice from '@/components/account/PasswordSetupNotice.vue';
import { useAuthStore } from '@/store/core/auth';
import { useNotificationStore } from '@/store/ui/notifications';

/** Change-email section of the account profile tab. */
const { t } = useI18n();
const authStore = useAuthStore();
const notifications = useNotificationStore();

const newEmail = ref<string>('');
const currentPassword = ref<string>('');
const code = ref<string>('');
const submitting = ref<boolean>(false);

async function handleSubmit() {
  if (submitting.value || !authStore.hasPassword) return;
  submitting.value = true;
  try {
    const result = await authStore.changeEmail(
      newEmail.value.trim(),
      currentPassword.value,
      code.value || undefined,
    );
    if (!result.ok) {
      notifications.show(result.message ?? t('common.states.error'), 'error');
      return;
    }
    newEmail.value = '';
    currentPassword.value = '';
    code.value = '';
    notifications.show(t('account.emailChanged'), 'success');
  } finally {
    submitting.value = false;
  }
}
</script>

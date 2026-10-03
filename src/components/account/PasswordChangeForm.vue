<template>
    <!-- No password yet (the account signs in another way): there is nothing to
         re-verify, so the emailed reset link is how one gets set. -->
    <div
      v-if="!authStore.hasPassword"
      class="space-y-3 max-w-sm"
    >
      <SectionHeading :label="t('account.passwordSection')" />

      <PasswordSetupNotice :hint="t('account.passwordNotSetHint')" />
    </div>

    <form
      v-else
      class="space-y-3 max-w-sm"
      @submit.prevent="handleSubmit"
    >
      <SectionHeading :label="t('account.passwordSection')" />

      <LabeledInput
        id="currentPassword"
        v-model="current"
        :label="t('account.currentPassword')"
        name="currentPassword"
        type="password"
        autocomplete="current-password"
        :placeholder="t('account.currentPassword')"
        required
      />
      <LabeledInput
        id="newPassword"
        v-model="next"
        :label="t('auth.reset.newPassword')"
        name="newPassword"
        type="password"
        autocomplete="new-password"
        :placeholder="t('auth.reset.newPassword')"
        required
      />
      <LabeledInput
        id="repeatPassword"
        v-model="repeat"
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

      <PrimaryButton
        type="submit"
        :label-text="t('account.changePassword')"
        :loading="submitting"
        :disabled="!current || !next || next !== repeat"
      />
    </form>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import LabeledInput from '@/components/core/input/LabeledInput.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import SectionHeading from '@/components/core/SectionHeading.vue';
import PasswordSetupNotice from '@/components/account/PasswordSetupNotice.vue';
import { useAuthStore } from '@/store/core/auth';
import { useNotificationStore } from '@/store/ui/notifications';

/**
 * Change-password section of the account profile tab. An account without a
 * password is offered the reset email instead, sent to its own address.
 */
const { t } = useI18n();
const authStore = useAuthStore();
const notifications = useNotificationStore();

const current = ref<string>('');
const next = ref<string>('');
const repeat = ref<string>('');
const submitting = ref<boolean>(false);

const mismatch = computed(() => repeat.value.length > 0 && next.value !== repeat.value);

async function handleSubmit() {
  if (submitting.value) return;
  submitting.value = true;
  try {
    const result = await authStore.changePassword(current.value, next.value);
    if (!result.ok) {
      notifications.show(result.message ?? t('common.states.error'), 'error');
      return;
    }
    current.value = '';
    next.value = '';
    repeat.value = '';
    notifications.show(t('account.passwordChanged'), 'success');
  } finally {
    submitting.value = false;
  }
}
</script>

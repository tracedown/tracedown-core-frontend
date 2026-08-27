<template>
    <div class="px-gutter py-4 space-y-8">
      <!-- Display name -->
      <form
        class="space-y-3 max-w-sm"
        @submit.prevent="handleSaveName"
      >
        <SectionHeading :label="t('account.profileSection')" />

        <p class="text-sm text-text-secondary">
          {{ authStore.user?.email }}
        </p>

        <LabeledInput
          id="displayName"
          v-model="displayName"
          :label="t('invite.displayName')"
          name="displayName"
          type="text"
          autocomplete="name"
          :placeholder="t('invite.displayName')"
          :disabled="!canEdit"
          required
        />
        <p
          v-if="!canEdit"
          class="text-xs text-text-secondary italic"
        >
          {{ t('account.profileEditDisabled') }}
        </p>

        <PrimaryButton
          v-if="canEdit"
          type="submit"
          :label-text="t('common.actions.save')"
          :loading="savingName"
          :disabled="!displayName.trim() || displayName.trim() === authStore.user?.displayName"
        />
      </form>

      <EmailChangeForm />

      <PasswordChangeForm />

      <TotpSection />

      <DataExportSection />

      <AccountClosureSection
        v-if="allowClosure"
        :owned-orgs="ownedOrgs"
      />
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import LabeledInput from '@/components/core/input/LabeledInput.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import SectionHeading from '@/components/core/SectionHeading.vue';
import AccountClosureSection from '@/components/account/AccountClosureSection.vue';
import DataExportSection from '@/components/account/DataExportSection.vue';
import EmailChangeForm from '@/components/account/EmailChangeForm.vue';
import PasswordChangeForm from '@/components/account/PasswordChangeForm.vue';
import TotpSection from '@/components/account/TotpSection.vue';
import type { OwnedOrgSummary } from '@/data/auth/AuthDto';
import { useAuthStore } from '@/store/core/auth';
import { useNotificationStore } from '@/store/ui/notifications';

/**
 * Profile & security: display name, email change, password change, two-factor,
 * data export and — where the platform allows it — account closure. Export sits
 * above closure deliberately: take your data before you end the account.
 */
const { t } = useI18n();
const authStore = useAuthStore();
const notifications = useNotificationStore();

const displayName = ref<string>(authStore.user?.displayName ?? '');
const canEdit = ref<boolean>(true);
const allowClosure = ref<boolean>(false);
const ownedOrgs = ref<OwnedOrgSummary[]>([]);
const savingName = ref<boolean>(false);

onMounted(async () => {
  const capabilities = await authStore.fetchProfileCapabilities();
  canEdit.value = capabilities.allowProfileEdit;
  allowClosure.value = capabilities.allowAccountClosure;
  ownedOrgs.value = capabilities.ownedOrgs;
});

async function handleSaveName() {
  if (savingName.value) return;
  savingName.value = true;
  try {
    const result = await authStore.updateProfile(displayName.value.trim());
    if (!result.ok) {
      notifications.show(result.message ?? t('common.states.error'), 'error');
      return;
    }
    notifications.show(t('account.profileSaved'), 'success');
  } finally {
    savingName.value = false;
  }
}
</script>

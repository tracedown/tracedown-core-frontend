<template>
    <div class="px-gutter py-4 space-y-8 max-w-2xl">
      <!-- Organization -->
      <form
        class="space-y-3 max-w-sm"
        @submit.prevent="handleRename"
      >
        <SectionHeading :label="t('settings.orgSection')" />

        <div>
          <p class="text-xs text-text-secondary mb-1">
            {{ t('settings.orgName') }}
          </p>
          <TextInput
            v-model="name"
            :disabled="!authStore.canWrite('settings')"
          />
        </div>
        <PrimaryButton
          v-if="authStore.canWrite('settings')"
          type="submit"
          :label-text="t('common.actions.save')"
          :loading="renaming"
          :disabled="!name.trim() || name.trim() === org.orgName"
        />

        <p class="text-xs text-text-secondary pt-1">
          {{ t('settings.orgId') }}:
          <button
            type="button"
            class="font-mono hover:text-accent-primary transition-colors cursor-pointer"
            :title="t('common.actions.copy')"
            @click="copyOrgId"
          >
            {{ org.orgId ?? '—' }}
          </button>
        </p>
      </form>

      <!-- Security -->
      <div class="space-y-3">
        <SectionHeading :label="t('settings.securitySection')" />

        <!-- Same wrapping switch row as the service form: on a phone the
             switch and its label share the first line and the hint takes the
             full width below (`contents` promotes both to flex items). -->
        <div class="flex items-start gap-3 max-md:flex-wrap max-md:items-center max-md:gap-y-1">
          <ToggleSwitch
            v-model="totpEnforced"
            class="mt-0.5 shrink-0 max-md:mt-0"
            :disabled="org.totpRequired === null || enforcementBusy || !authStore.canWrite('settings')"
          />
          <span class="min-w-0 max-md:contents">
            <span class="block text-sm text-text-primary">{{ t('settings.totpEnforcement') }}</span>
            <span class="block text-xs text-text-secondary max-md:w-full">{{ t('settings.totpEnforcementHint') }}</span>
          </span>
        </div>
      </div>

      <!-- Defaults -->
      <div class="space-y-3">
        <SectionHeading :label="t('settings.defaultsSection')" />

        <div>
          <span class="block text-sm text-text-primary mb-1">{{ t('settings.defaultTimezone') }}</span>
          <span class="block text-xs text-text-secondary mb-2">{{ t('settings.defaultTimezoneHint') }}</span>
          <AppSelect
            v-model="defaultTimezone"
            class="w-64"
            searchable
            :options="TIMEZONE_OPTIONS"
            :disabled="org.defaultTimezone === null || timezoneBusy || !authStore.canWrite('settings')"
          />
        </div>
      </div>

      <!-- Danger zone (owner only) -->
      <div
        v-if="authStore.isOwner"
        class="space-y-4 rounded-lg border border-status-failure/40 p-4"
      >
        <SectionHeading :label="t('settings.dangerZone')" />

        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div class="min-w-0">
            <p class="text-sm text-text-primary">
              {{ t('users.transferOwnership') }}
            </p>
            <p class="text-xs text-text-secondary">
              {{ t('settings.ownershipHint') }}
            </p>
          </div>
          <SecondaryButton
            class="shrink-0"
            :label-text="t('users.transferOwnership')"
            :fa-icon="faCrown"
            :on-click="() => transferOpen = true"
          />
        </div>

        <div class="flex items-start justify-between gap-4 flex-wrap border-t border-status-failure/20 pt-4">
          <div class="min-w-0">
            <p class="text-sm text-text-primary">
              {{ t('settings.deleteOrg') }}
            </p>
            <p class="text-xs text-text-secondary">
              {{ t('settings.deleteOrgHint') }}
            </p>
          </div>
          <DangerButton
            class="shrink-0"
            :label-text="t('settings.deleteOrg')"
            :on-click="() => deleteOpen = true"
          />
        </div>

        <TransferOwnershipForm
          v-if="transferOpen"
          @close="transferOpen = false"
        />
        <DeleteOrgModal
          v-if="deleteOpen"
          @close="deleteOpen = false"
        />
      </div>

      <SlotOutlet name="org-settings-extra" />
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { faCrown } from '@fortawesome/free-solid-svg-icons';
import SectionHeading from '@/components/core/SectionHeading.vue';
import AppSelect from '@/components/core/input/AppSelect.vue';
import TextInput from '@/components/core/input/TextInput.vue';
import ToggleSwitch from '@/components/core/input/ToggleSwitch.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import SecondaryButton from '@/components/core/buttons/SecondaryButton.vue';
import TransferOwnershipForm from '@/components/users/members/TransferOwnershipForm.vue';
import DeleteOrgModal from '@/components/settings/DeleteOrgModal.vue';
import DangerButton from '@/components/core/buttons/DangerButton.vue';
import SlotOutlet from '@/components/core/SlotOutlet.vue';
import { useAuthStore } from '@/store/core/auth';
import { useOrgStore } from '@/store/core/org';
import { useOrgUserStore } from '@/store/core/orgUser';
import { useNotificationStore } from '@/store/ui/notifications';
import { TIMEZONE_OPTIONS } from '@/lib/timezones';

/**
 * Org-level general settings: name, 2FA enforcement, defaults, and the
 * owner-only ownership handover (target picked from the active members).
 */
const { t } = useI18n();
const authStore = useAuthStore();
const org = useOrgStore();
const orgUserStore = useOrgUserStore();
const notifications = useNotificationStore();

// ── Org name ──
const name = ref<string>('');
const renaming = ref<boolean>(false);

async function handleRename() {
  if (renaming.value) return;
  renaming.value = true;
  try {
    const result = await org.updateName(name.value.trim());
    if (!result.ok) {
      notifications.show(result.message ?? t('common.states.error'), 'error');
      return;
    }
    notifications.show(t('settings.orgRenamed'), 'success');
  } finally {
    renaming.value = false;
  }
}

async function copyOrgId() {
  if (!org.orgId) return;
  await navigator.clipboard.writeText(org.orgId);
  notifications.show(t('common.states.copied'), 'success');
}

// ── 2FA enforcement (renders from store state; a failed call stays put) ──
const enforcementBusy = ref<boolean>(false);
const totpEnforced = computed({
  get: () => org.totpRequired === true,
  set: (value: boolean) => {
    void onToggleEnforcement(value);
  },
});

async function onToggleEnforcement(value: boolean) {
  enforcementBusy.value = true;
  try {
    const result = await org.setTotpEnforced(value);
    if (!result.ok && result.message) notifications.show(result.message, 'error');
  } finally {
    enforcementBusy.value = false;
  }
}

// ── Default timezone ──
const timezoneBusy = ref<boolean>(false);
const defaultTimezone = computed({
  get: () => org.defaultTimezone ?? 'UTC',
  set: (value: string) => {
    void onChangeTimezone(value);
  },
});

async function onChangeTimezone(value: string) {
  timezoneBusy.value = true;
  try {
    const result = await org.setDefaultTimezone(value);
    if (!result.ok && result.message) notifications.show(result.message, 'error');
  } finally {
    timezoneBusy.value = false;
  }
}

// ── Danger zone ──
const transferOpen = ref<boolean>(false);
const deleteOpen = ref<boolean>(false);

onMounted(async () => {
  await org.fetchSettings();
  name.value = org.orgName ?? '';
  if (authStore.isOwner) {
    void orgUserStore.fetchUsers({ silent: true });
  }
});
</script>

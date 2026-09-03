<template>
    <ModalDialog
      :modal-name="t('users.transferOwnership')"
      @close="emit('close')"
    >
      <p class="text-xs text-text-secondary mb-3">
        {{ t('settings.ownershipHint') }}
      </p>

      <div class="space-y-3 max-w-sm">
        <div>
          <span class="block text-xs font-medium text-text-secondary mb-1">
            {{ t('settings.newOwner') }}
          </span>
          <AppSelect
            v-model="targetUserId"
            searchable
            :options="memberOptions"
          />
        </div>

        <p
          v-if="target"
          class="text-xs text-text-secondary"
        >
          {{ t('users.transferPrompt', { name: target.displayName }) }}
        </p>

        <TextInput
          v-model="password"
          compact
          type="password"
          autocomplete="current-password"
          :placeholder="t('auth.password')"
        />
        <div v-if="totpEnabled">
          <span class="block text-xs font-medium text-text-secondary mb-1">
            {{ t('auth.totpLabel') }}
          </span>
          <OtpCodeInput
            v-model="code"
            :disabled="submitting"
          />
        </div>
      </div>

      <!--  Pinned above the fold on a phone, inline on desktop.  -->
      <template #footer>
        <div class="flex items-center gap-2">
          <PrimaryButton
            :label-text="t('users.transferConfirm')"
            :loading="submitting"
            :disabled="!target || !password || (totpEnabled && code.length < 6)"
            :hold-offset-sec="3"
            @safe-click="submit"
          />
          <GhostButton
            :label-text="t('common.actions.cancel')"
            :on-click="() => emit('close')"
          />
        </div>
      </template>
    </ModalDialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ModalDialog from '@/components/core/ModalDialog.vue';
import AppSelect from '@/components/core/input/AppSelect.vue';
import TextInput from '@/components/core/input/TextInput.vue';
import OtpCodeInput from '@/components/core/input/OtpCodeInput.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import GhostButton from '@/components/core/buttons/GhostButton.vue';
import { useAuthStore } from '@/store/core/auth';
import { useOrgUserStore } from '@/store/core/orgUser';
import { useNotificationStore } from '@/store/ui/notifications';
import type { SelectOption } from '@/types/ui/common';

/**
 * Owner-only ownership handover: pick the member inside the modal, then
 * re-verify the owner's password (and TOTP when enrolled) to transfer.
 */
const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();
const authStore = useAuthStore();
const orgUserStore = useOrgUserStore();
const notifications = useNotificationStore();

const targetUserId = ref<string>('');
const password = ref<string>('');
const code = ref<string>('');
const submitting = ref<boolean>(false);

const memberOptions = computed<SelectOption[]>(() =>
  orgUserStore.users
    .filter(u => u.isActive && !u.isOwner)
    .map(u => ({ value: u.userId, label: `${u.displayName} (${u.email})` })));

const target = computed(() =>
  orgUserStore.users.find(u => u.userId === targetUserId.value) ?? null);

const totpEnabled = computed(() => authStore.user?.totpEnabled ?? false);

async function submit() {
  submitting.value = true;
  try {
    if (!target.value) return;
    const result = await orgUserStore.transferOwnership(
      target.value.userId,
      password.value,
      totpEnabled.value ? code.value : undefined,
    );
    if (!result.ok) {
      if (result.message) notifications.show(result.message, 'error');
      return;
    }
    notifications.show(t('users.transferDone'), 'success');
    emit('close');
    // Owner flag changed for both sides — resync ourselves and the list.
    void authStore.fetchMe();
    void orgUserStore.fetchUsers({ force: true });
  } finally {
    submitting.value = false;
  }
}
</script>

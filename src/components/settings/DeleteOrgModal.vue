<template>
    <ModalDialog
      :modal-name="t('settings.deleteOrg')"
      @close="emit('close')"
    >
      <p class="text-xs text-status-failure mb-3">
        {{ t('settings.deleteOrgWarning', { name: org.orgName ?? '' }) }}
      </p>

      <div class="space-y-3 max-w-sm">
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

        <div class="flex items-center gap-2">
          <DangerButton
            :label-text="t('settings.deleteOrgConfirm')"
            :disabled="!password || (totpEnabled && code.length < 6) || submitting"
            :hold-offset-sec="3"
            @safe-click="submit"
          />
          <GhostButton
            :label-text="t('common.actions.cancel')"
            :on-click="() => emit('close')"
          />
        </div>
      </div>
    </ModalDialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import ModalDialog from '@/components/core/ModalDialog.vue';
import TextInput from '@/components/core/input/TextInput.vue';
import OtpCodeInput from '@/components/core/input/OtpCodeInput.vue';
import DangerButton from '@/components/core/buttons/DangerButton.vue';
import GhostButton from '@/components/core/buttons/GhostButton.vue';
import { useAuthStore } from '@/store/core/auth';
import { useOrgStore } from '@/store/core/org';
import { useNotificationStore } from '@/store/ui/notifications';
import { getDeleteOrgHandler } from '@/config/extensions';

/**
 * Owner-only outright org deletion, confirmed like an ownership transfer
 * (password + TOTP when enrolled). On success the session is torn down —
 * the org, and this session's context with it, no longer exist.
 */
const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const org = useOrgStore();
const notifications = useNotificationStore();

const password = ref<string>('');
const code = ref<string>('');
const submitting = ref<boolean>(false);

const totpEnabled = computed(() => authStore.user?.totpEnabled ?? false);

async function submit() {
  if (submitting.value) return;
  submitting.value = true;
  try {
    // A host may route deletion through its own flow; otherwise delete
    // immediately. Either way it gets the credentials collected here, so the
    // owner confirms once and a host handler can delegate back to `deleteOrg`.
    const credentials = {
      password: password.value,
      code: totpEnabled.value ? code.value : undefined,
    };
    const handler = getDeleteOrgHandler();
    const result = handler
      ? await handler(credentials)
      : await org.deleteOrg(credentials.password, credentials.code);
    if (!result.ok) {
      if (result.message) notifications.show(result.message, 'error');
      return;
    }
    authStore.clearSession();
    await router.push({ name: 'login' });
  } finally {
    submitting.value = false;
  }
}
</script>

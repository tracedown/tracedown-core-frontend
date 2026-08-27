<template>
    <div class="space-y-3 max-w-sm">
      <SectionHeading :label="t('account.closureSection')" />

      <p class="text-xs text-text-secondary">
        {{ t('account.closureHint') }}
      </p>

      <!-- Owned organizations that have to be handed over first. -->
      <p
        v-if="blockingOrgs.length > 0"
        class="text-xs text-status-failure"
      >
        {{ t('account.closureBlockedByOrgs', { orgs: blockingOrgs.map(o => o.name).join(', ') }) }}
      </p>

      <DangerButton
        :label-text="t('account.closureButton')"
        :disabled="blockingOrgs.length > 0"
        :on-click="() => (confirming = true)"
      />

      <ModalDialog
        v-if="confirming"
        :modal-name="t('account.closureButton')"
        @close="close"
      >
        <div class="space-y-3 max-w-sm">
          <p class="text-xs text-status-failure">
            {{ t('account.closureWarning') }}
          </p>

          <!-- Sole-member organizations go with the account, but only on request. -->
          <div
            v-if="soleMemberOrgs.length > 0"
            class="flex items-start gap-2"
          >
            <ToggleSwitch
              v-model="deleteOwnedOrgs"
              :disabled="submitting"
            />
            <span class="text-xs text-text-secondary">
              {{ t('account.closureDeleteOrgs', { orgs: soleMemberOrgs.map(o => o.name).join(', ') }) }}
            </span>
          </div>

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
              :label-text="t('account.closureConfirm')"
              :disabled="!canSubmit || submitting"
              :hold-offset-sec="3"
              @safe-click="submit"
            />
            <GhostButton
              :label-text="t('common.actions.cancel')"
              :on-click="close"
            />
          </div>
        </div>
      </ModalDialog>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import DangerButton from '@/components/core/buttons/DangerButton.vue';
import GhostButton from '@/components/core/buttons/GhostButton.vue';
import ModalDialog from '@/components/core/ModalDialog.vue';
import OtpCodeInput from '@/components/core/input/OtpCodeInput.vue';
import SectionHeading from '@/components/core/SectionHeading.vue';
import TextInput from '@/components/core/input/TextInput.vue';
import ToggleSwitch from '@/components/core/input/ToggleSwitch.vue';
import type { OwnedOrgSummary } from '@/data/auth/AuthDto';
import { useAuthStore } from '@/store/core/auth';
import { useNotificationStore } from '@/store/ui/notifications';

/**
 * Self-service account closure. Rendered only where the platform allows it —
 * on a managed install accounts are the operator's to remove, so the section
 * does not exist at all rather than offering a button that always refuses.
 *
 * Confirmed like deleting an organization (password, plus a code when
 * two-factor is enrolled), because it ends just as much. An organization this
 * account owns blocks the closure; where nobody else is a member of it, it can
 * be taken along in the same step instead of forcing a hand-off to nobody.
 */
const props = defineProps<{
  /** Organizations this account owns, from the profile capabilities call. */
  ownedOrgs: OwnedOrgSummary[];
}>();

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const notifications = useNotificationStore();

const confirming = ref<boolean>(false);
const password = ref<string>('');
const code = ref<string>('');
const deleteOwnedOrgs = ref<boolean>(false);
const submitting = ref<boolean>(false);

const soleMemberOrgs = computed(() => props.ownedOrgs.filter(o => o.soleMember));
const blockingOrgs = computed(() => props.ownedOrgs.filter(o => !o.soleMember));
const totpEnabled = computed(() => authStore.user?.totpEnabled ?? false);

const canSubmit = computed(() =>
  password.value.length > 0
  && (!totpEnabled.value || code.value.length >= 6)
  && (soleMemberOrgs.value.length === 0 || deleteOwnedOrgs.value));

function close() {
  confirming.value = false;
  password.value = '';
  code.value = '';
  deleteOwnedOrgs.value = false;
}

async function submit() {
  if (submitting.value) return;
  submitting.value = true;
  try {
    const result = await authStore.closeAccount({
      password: password.value,
      code: totpEnabled.value ? code.value : undefined,
      deleteOwnedOrgs: deleteOwnedOrgs.value,
    });
    if (!result.ok) {
      if (result.message) notifications.show(result.message, 'error');
      return;
    }
    // The account is gone; so is anything this session could still reach.
    authStore.clearSession();
    await router.push({ name: 'login' });
  } finally {
    submitting.value = false;
  }
}
</script>

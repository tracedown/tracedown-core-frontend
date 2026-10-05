<template>
    <div
      class="space-y-2"
      data-testid="password-setup-notice"
    >
      <p class="text-xs text-text-secondary">
        {{ hint ?? t('account.passwordRequiredHint') }}
      </p>

      <!-- Once sent, the offer steps back for a minute: a second request voids
           the link already in the inbox, so it is not the first thing to press. -->
      <p
        v-if="sent"
        ref="statusEl"
        class="text-xs text-text-primary"
        role="status"
        tabindex="-1"
      >
        {{ t('account.passwordLinkSent', { email }) }}
        <template v-if="!canResend">
          {{ t('account.passwordLinkResendSoon') }}
        </template>
      </p>
      <template v-if="!sent || canResend">
        <PrimaryButton
          v-if="variant === 'primary'"
          :label-text="sent ? t('account.sendPasswordLinkAgain') : t('account.sendPasswordLink')"
          :loading="sending"
          :disabled="!email"
          :on-click="handleSend"
        />
        <LinkButton
          v-else
          :label-text="sent ? t('account.sendPasswordLinkAgain') : t('account.sendPasswordLink')"
          :disabled="!email || sending"
          @click="handleSend"
        />
        <p
          v-if="sent"
          class="text-xs text-text-secondary"
        >
          {{ t('account.passwordLinkResendVoids') }}
        </p>
      </template>
    </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import LinkButton from '@/components/core/buttons/LinkButton.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import { usePasswordSetupLink } from '@/composables/usePasswordSetupLink';
import { useNotificationStore } from '@/store/ui/notifications';

/**
 * Stands in for a "current password" field when the account has no password
 * (it signs in another way): says why the action cannot be confirmed yet and
 * offers the emailed link that sets one. The surrounding form keeps its submit
 * disabled — there is nothing it could send.
 *
 * `variant="link"` renders the offer as a text link, for a place that sits
 * beside another notice already carrying the primary button.
 */
withDefaults(defineProps<{
  /** Overrides the default "this action needs a password" sentence. */
  hint?: string;
  variant?: 'primary' | 'link';
}>(), {
  hint: undefined,
  variant: 'primary',
});

const { t } = useI18n();
const notifications = useNotificationStore();
const { email, sending, sent, canResend, send } = usePasswordSetupLink();
const statusEl = ref<HTMLElement | null>(null);

async function handleSend() {
  const result = await send();
  if (!result.ok && result.message) notifications.show(result.message, 'error');
  // The button just pressed is gone; keep focus on what replaced it.
  if (result.ok) {
    await nextTick();
    statusEl.value?.focus();
  }
}
</script>

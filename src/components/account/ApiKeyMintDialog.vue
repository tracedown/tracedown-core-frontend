<template>
    <ModalDialog
      :modal-name="issued ? t('apiKeys.mint.issuedTitle') : t('apiKeys.mint.title')"
      :persistent="!issued && (dirty || submitting)"
      @close="requestClose"
    >
      <!-- The key, this once. Closing is held back until it is acknowledged. -->
      <ApiKeyIssuedPanel
        v-if="issued"
        ref="issuedPanel"
        v-model:acknowledged="acknowledged"
        :issued="issued"
        :blocked-message="blockedMessage"
      />

      <form
        v-else
        class="space-y-3 w-lg max-w-full p-2 max-md:p-0"
        @submit.prevent="submit"
      >
        <p class="text-sm text-text-secondary">
          {{ t('apiKeys.mint.orgNote', { org: orgName }) }}
        </p>
        <p class="text-sm text-text-secondary">
          {{ t('apiKeys.mint.shownOnce') }}
        </p>

        <LabeledInput
          :id="nameId"
          v-model="name"
          :label="t('apiKeys.columns.name')"
          :placeholder="t('apiKeys.namePlaceholder')"
          maxlength="128"
          autocomplete="off"
        />

        <fieldset class="space-y-1">
          <legend class="text-sm font-medium text-text-primary mb-1">
            {{ t('apiKeys.columns.access') }}
          </legend>
          <label
            v-for="level in API_KEY_ACCESS_LEVELS"
            :key="level"
            class="flex items-start gap-2 cursor-pointer py-1"
          >
            <input
              v-model="access"
              type="radio"
              name="api-key-access"
              :value="level"
              class="mt-1 accent-accent-primary"
            >
            <span class="min-w-0">
              <span class="block text-sm text-text-primary">{{ t(`apiKeys.access.${level}`) }}</span>
              <span class="block text-xs text-text-secondary">{{ t(`apiKeys.accessHints.${level}`) }}</span>
            </span>
          </label>
        </fieldset>

        <div class="flex items-end gap-2 max-md:flex-col max-md:items-stretch">
          <div>
            <p class="text-sm font-medium text-text-primary mb-1">
              {{ t('apiKeys.expiry') }}
            </p>
            <AppSelect
              v-model="expiry"
              class="w-44"
              :aria-label="t('apiKeys.expiry')"
              :options="expiryOptions"
            />
          </div>
          <LabeledInput
            v-if="expiry === 'custom'"
            v-model="customDays"
            class="w-32"
            :label="t('apiKeys.mint.customDaysLabel')"
            type="text"
            inputmode="numeric"
            :placeholder="t('apiKeys.mint.customDaysPlaceholder')"
          />
        </div>
        <p
          v-if="expiry === 'custom' && customDays && expiresInDays === null"
          role="alert"
          class="text-xs text-status-failure"
        >
          {{ t('apiKeys.mint.customDaysInvalid', { min: MIN_EXPIRY_DAYS, max: MAX_EXPIRY_DAYS }) }}
        </p>

        <!-- No password to confirm with: how to set one, and nothing to submit. -->
        <PasswordSetupNotice v-if="!hasPassword" />
        <div v-else>
          <LabeledInput
            v-model="password"
            :label="t('account.currentPassword')"
            type="password"
            autocomplete="current-password"
          />
          <p
            v-if="errors.password || passwordIsBlank"
            role="alert"
            class="text-xs text-status-failure mt-1"
          >
            {{ errors.password || t('apiKeys.mint.passwordBlank') }}
          </p>
        </div>

        <!-- Shown when the profile says the user is enrolled, and also after a
             code was refused: the profile here may predate an enrolment. -->
        <div v-if="showCode">
          <LabeledInput
            v-model="code"
            :label="t('account.totpCode')"
            autocomplete="one-time-code"
          />
          <p class="text-xs text-text-secondary mt-1">
            {{ t('apiKeys.mint.codeHint') }}
          </p>
          <p
            v-if="errors.code"
            role="alert"
            class="text-xs text-status-failure mt-1"
          >
            {{ errors.code }}
          </p>
        </div>

        <p
          v-if="errors.form"
          role="alert"
          class="text-xs text-status-failure"
        >
          {{ errors.form }}
        </p>

        <p
          role="status"
          class="text-xs text-status-warning"
        >
          {{ blockedMessage }}
        </p>

        <!-- The visible actions sit in the dialog footer, outside this form;
             this is what lets Enter submit it. -->
        <button
          type="submit"
          class="sr-only"
          tabindex="-1"
          :disabled="!canSubmit || submitting"
        >
          {{ t('apiKeys.mint.submit') }}
        </button>
      </form>

      <template #footer>
        <div class="flex justify-end gap-2 px-2 pb-2 max-md:p-0">
          <PrimaryButton
            v-if="issued"
            :label-text="t('common.actions.done')"
            :on-click="requestClose"
          />
          <template v-else>
            <SecondaryButton
              :label-text="t('common.actions.cancel')"
              :disabled="submitting"
              :on-click="requestClose"
            />
            <PrimaryButton
              :label-text="t('apiKeys.mint.submit')"
              :loading="submitting"
              :disabled="!canSubmit"
              :on-click="submit"
            />
          </template>
        </div>
      </template>
    </ModalDialog>
</template>

<script setup lang="ts">
import { computed, useId, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';
import ModalDialog from '@/components/core/ModalDialog.vue';
import LabeledInput from '@/components/core/input/LabeledInput.vue';
import AppSelect from '@/components/core/input/AppSelect.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import SecondaryButton from '@/components/core/buttons/SecondaryButton.vue';
import ApiKeyIssuedPanel from '@/components/account/ApiKeyIssuedPanel.vue';
import PasswordSetupNotice from '@/components/account/PasswordSetupNotice.vue';
import { useApiKeyMint } from '@/composables/useApiKeyMint';
import { useLeaveGuard } from '@/composables/useLeaveGuard';
import { useOrgStore } from '@/store/core/org';
import { API_KEY_ACCESS_LEVELS } from '@/data/apikeys/ApiKeyDto';
import { EXPIRY_CHOICES, MAX_EXPIRY_DAYS, MIN_EXPIRY_DAYS } from '@/lib/apiKeys';
import type { SelectOption } from '@/types/ui/common';

/**
 * Mints an API key acting as the signed-in user in the session's current
 * organization. Asks for the password again, and a TOTP or recovery code when
 * the user has a second factor — a key outlives the session it was made in.
 * An account without a password is offered the link that sets one instead,
 * and cannot mint until it has one.
 *
 * The key is shown once, inside this dialog, and is dropped with it. Neither
 * closing the dialog nor leaving the page lets go of an unacknowledged key or a
 * mint in flight: a refused close says why, and on the key moves focus to the
 * acknowledgement. Done stays enabled so that a click on it can say so too.
 */
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
const orgStore = useOrgStore();
const issuedPanel = useTemplateRef<InstanceType<typeof ApiKeyIssuedPanel>>('issuedPanel');

const nameId = useId();
const {
  name, access, expiry, customDays, password, code, submitting, errors,
  issued, acknowledged, blockedMessage, expiresInDays, hasPassword, showCode, canSubmit, dirty,
  passwordIsBlank, submit, mustStay,
} = useApiKeyMint(nameId);

const orgName = computed(() => orgStore.currentOrg?.name ?? orgStore.orgName ?? '');

const expiryOptions = computed<SelectOption[]>(() => EXPIRY_CHOICES.map(choice => ({
  value: choice,
  label: t(`apiKeys.expiryChoices.${choice}`),
})));

/** Refuses to let go while a mint is in flight or its key is unacknowledged. */
function holdBack(): boolean {
  if (!mustStay.value) return false;
  if (issued.value) {
    blockedMessage.value = t('apiKeys.mint.acknowledgeFirst');
    issuedPanel.value?.focusAcknowledge();
  } else {
    blockedMessage.value = t('apiKeys.mint.waitForMint');
  }
  return true;
}

useLeaveGuard(holdBack, mustStay);

function requestClose() {
  if (holdBack()) return;
  issued.value = null;
  emit('close');
}
</script>

<template>
    <div class="w-full max-w-sm space-y-4">
      <h2 class="text-lg font-semibold text-text-primary">
        {{ t('auth.totpSetup.title') }}
      </h2>

      <!-- Step 1: idle — trigger enrollment (parent fetches the secret). -->
      <div
        v-if="step === 'idle'"
        class="space-y-4"
      >
        <p class="text-sm text-text-secondary">
          {{ t('auth.totpSetup.idleStep.description') }}
        </p>

        <p
          v-if="error"
          class="text-status-failure text-sm"
        >
          {{ error }}
        </p>

        <PrimaryButton
          full-width
          :label-text="t('auth.totpSetup.idleStep.submit')"
          :loading="loading"
          :on-click="() => emit('start')"
        />
      </div>

      <!-- Step 2: show secret/QR and verify a code -->
      <form
        v-else-if="step === 'verify'"
        class="space-y-4"
        @submit.prevent="emit('confirm', code)"
      >
        <p class="text-sm text-text-secondary">
          {{ t('auth.totpSetup.verifyStep.description') }}
        </p>

        <!-- On a phone the QR code is on the same screen as the app that would
             scan it. Authenticator apps register the otpauth:// scheme, so a
             plain link to the same URI hands the account over directly. Not a
             button component: this has to be a real anchor for the OS to route
             the scheme, and it is hidden on desktop where nothing handles it. -->
        <a
          v-if="otpauthUri"
          :href="otpauthUri"
          class="flex h-8 w-full items-center justify-center gap-2 rounded-lg border
                 border-text-secondary bg-accent-secondary px-3 py-1 text-sm font-bold
                 text-text-primary active:opacity-70 md:hidden"
        >
          <FontAwesomeIcon :icon="faMobileScreen" />
          {{ t('auth.totpSetup.verifyStep.openApp') }}
        </a>

        <!-- QR rendered from the otpauth URI; override via the #qr slot if needed. -->
        <slot
          name="qr"
          :uri="otpauthUri"
        >
          <div
            v-if="qrDataUri"
            class="flex justify-center rounded-lg bg-white p-3"
          >
            <img
              :src="qrDataUri"
              :alt="t('auth.totpSetup.title')"
              class="h-40 w-40"
            >
          </div>
          <div
            v-else
            class="flex flex-col items-center justify-center gap-2 h-40 rounded-lg
                   border border-dashed border-text-secondary/40 text-text-secondary"
          >
            <FontAwesomeIcon
              :icon="faQrcode"
              size="2x"
            />
            <span class="text-xs">{{ t('auth.totpSetup.verifyStep.qrPlaceholder') }}</span>
          </div>
        </slot>

        <div>
          <span class="block text-sm font-medium text-text-primary mb-1">
            {{ t('auth.totpSetup.verifyStep.secretLabel') }}
          </span>
          <CopyField
            :value="secret"
            :title="t('auth.totpSetup.copy')"
            value-class="flex-1 rounded-lg bg-accent-secondary p-2 text-sm font-mono text-text-primary"
            icon-color-class="text-accent-primary hover:bg-background-secondary"
          />
        </div>

        <div>
          <label
            for="totp-code"
            class="block text-sm font-medium text-text-primary mb-1"
          >
            {{ t('auth.totpSetup.verifyStep.codeLabel') }}
          </label>
          <TextInput
            id="totp-code"
            v-model="code"
            name="one-time-code"
            type="text"
            autocomplete="one-time-code"
            :placeholder="t('auth.totpSetup.verifyStep.codeLabel')"
            :disabled="loading"
            required
          />
        </div>

        <p
          v-if="error"
          class="text-status-failure text-sm"
        >
          {{ error }}
        </p>

        <PrimaryButton
          type="submit"
          full-width
          :label-text="t('auth.totpSetup.verifyStep.submit')"
          :loading="loading"
          :disabled="!code"
        />
      </form>

      <!-- Step 3: one-time recovery codes -->
      <div
        v-else
        class="space-y-4"
      >
        <h3 class="text-base font-semibold text-text-primary">
          {{ t('auth.totpSetup.recoveryStep.title') }}
        </h3>
        <p class="text-sm text-text-secondary">
          {{ t('auth.totpSetup.recoveryStep.description') }}
        </p>

        <ul class="grid grid-cols-2 gap-2 rounded-lg bg-accent-secondary p-3 font-mono text-sm text-text-primary">
          <li
            v-for="recoveryCode in recoveryCodes"
            :key="recoveryCode"
            class="tabular-nums"
          >
            {{ recoveryCode }}
          </li>
        </ul>

        <LinkButton
          :label-text="recoveryCopied ? t('auth.totpSetup.copied') : t('auth.totpSetup.copy')"
          :fa-icon="recoveryCopied ? faCheck : faCopy"
          size-class="text-sm"
          @click="copy(recoveryCodes.join('\n'))"
        />

        <PrimaryButton
          full-width
          :label-text="t('auth.totpSetup.recoveryStep.done')"
          :on-click="() => emit('done')"
        />
      </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { faQrcode, faCopy, faCheck, faMobileScreen } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { renderSVG } from 'uqr';
import CopyField from '@/components/common/CopyField.vue';
import TextInput from '@/components/core/input/TextInput.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import LinkButton from '@/components/core/buttons/LinkButton.vue';
import { useNotificationStore } from '@/store/ui/notifications';

type Step = 'idle' | 'verify' | 'recovery';

const props = withDefaults(
  defineProps<{
    /** Base32 secret from enrollment. Its presence advances to the verify step. */
    secret?: string;
    /** otpauth:// URI from enrollment, for QR rendering. */
    otpauthUri?: string;
    /** One-time codes from POST /auth/totp/setup/confirm. Their presence advances to the recovery step. */
    recoveryCodes?: string[];
    /** Disables inputs and shows a spinner while a request is in flight. */
    loading?: boolean;
    /** Resolved, user-facing error for the current step. */
    error?: string;
  }>(),
  {
    secret: '',
    otpauthUri: '',
    recoveryCodes: () => [],
    loading: false,
    error: '',
  },
);

const emit = defineEmits<{
  /** Begin enrollment: parent should call POST /auth/totp/enroll, then fill `secret`/`otpauthUri`. */
  (e: 'start'): void;
  /** Parent should call /auth/totp/setup/confirm with this code. */
  (e: 'confirm', code: string): void;
  /** Enrollment finished and recovery codes acknowledged. */
  (e: 'done'): void;
}>();

const { t } = useI18n();

const code = ref<string>('');

// The step is derived from which data the parent has supplied, so filling
// props from API responses advances the form without extra local state.
const step = computed<Step>(() => {
  if (props.recoveryCodes.length > 0) return 'recovery';
  if (props.secret) return 'verify';
  return 'idle';
});

const qrDataUri = computed<string>(() =>
  props.otpauthUri
    ? `data:image/svg+xml;utf8,${encodeURIComponent(renderSVG(props.otpauthUri))}`
    : '',);

const notifications = useNotificationStore();

const copied = ref<string>('');
async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    copied.value = value;
  } catch {
    notifications.show(t('errors.unknown_error'), 'error');
  }
}

const recoveryCopied = computed(() => copied.value === props.recoveryCodes.join('\n'));
</script>

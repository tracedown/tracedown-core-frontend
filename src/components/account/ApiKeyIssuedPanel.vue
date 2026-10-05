<template>
    <div class="space-y-3 w-lg max-w-full p-2 max-md:p-0">
      <div class="rounded-lg border border-status-warning/40 bg-status-warning/5 p-4 space-y-2">
        <p class="text-sm text-text-primary">
          {{ t('apiKeys.mint.issued', { name: issued.name, org: issued.organizationName }) }}
        </p>
        <div class="flex items-center gap-2">
          <code class="min-w-0 flex-1 text-xs font-mono text-text-primary bg-background-primary rounded px-2 py-1.5 break-all">
            {{ issued.key }}
          </code>
          <IconButton
            :id="copyButtonId"
            :fa-icon="faCopy"
            :title="t('common.actions.copy')"
            :aria-label="t('common.actions.copy')"
            color-class="text-text-secondary hover:text-accent-primary"
            @click="copyKey"
          />
        </div>
        <p class="text-xs font-medium text-status-warning">
          {{ t('apiKeys.mint.notShownAgain') }}
        </p>
        <p class="text-xs text-text-secondary">
          {{ t('apiKeys.mint.usageHint') }}
        </p>
        <p class="text-xs text-text-secondary">
          {{ t('apiKeys.mint.baseUrl') }}
          <code class="font-mono text-text-primary break-all">{{ urls.baseUrl }}</code>
        </p>
        <p class="text-xs">
          <a
            :href="urls.descriptionUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-accent-primary hover:underline"
          >{{ t('apiKeys.mint.description') }}</a>
        </p>
        <p class="text-xs text-text-secondary">
          {{ t('apiKeys.mint.survivesAccountChanges') }}
        </p>
      </div>

      <label class="flex items-start gap-2 cursor-pointer">
        <input
          :id="ackId"
          v-model="acknowledged"
          type="checkbox"
          class="mt-0.5 accent-accent-primary"
        >
        <span class="text-sm text-text-primary">{{ t('apiKeys.mint.acknowledge') }}</span>
      </label>
      <p
        role="status"
        class="text-xs text-status-warning"
      >
        {{ blockedMessage }}
      </p>
      <p
        role="status"
        class="sr-only"
      >
        {{ copyStatus }}
      </p>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { faCopy } from '@fortawesome/free-solid-svg-icons';
import IconButton from '@/components/core/buttons/IconButton.vue';
import { useNotificationStore } from '@/store/ui/notifications';
import { env } from '@/config/env';
import { publicApiUrls } from '@/lib/apiKeys';
import type { ApiKeySummary } from '@/data/apikeys/ApiKeyDto';

/**
 * The just-minted key, shown this once: the key with a copy control, where to
 * send it, and the acknowledgement the dialog waits for before it may close.
 * `blockedMessage` is the dialog's explanation of a close it refused.
 */
const props = defineProps<{
  issued: ApiKeySummary;
  blockedMessage: string;
}>();

const acknowledged = defineModel<boolean>('acknowledged', { required: true });

const { t } = useI18n();
const notifications = useNotificationStore();

const copyButtonId = useId();
const ackId = useId();
const copyStatus = ref<string>('');

const urls = computed(() => publicApiUrls(env.apiUrl, window.location.origin));

async function copyKey() {
  const key = props.issued.key;
  if (!key) return;
  try {
    await navigator.clipboard.writeText(key);
    copyStatus.value = t('common.states.copied');
    notifications.show(copyStatus.value, 'success');
  } catch {
    copyStatus.value = t('apiKeys.mint.copyFailed');
    notifications.show(copyStatus.value, 'error');
  }
}

/** Moves focus to the acknowledgement, after a close that was refused for want of it. */
function focusAcknowledge() {
  document.getElementById(ackId)?.focus();
}

defineExpose({ focusAcknowledge });

onMounted(() => {
  void nextTick(() => document.getElementById(copyButtonId)?.focus());
});
</script>

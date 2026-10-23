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
 * The just-minted key, shown this once: the key with a copy control and where
 * to send it.
 */
const props = defineProps<{
  issued: ApiKeySummary;
}>();

const { t } = useI18n();
const notifications = useNotificationStore();

const copyButtonId = useId();
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

onMounted(() => {
  void nextTick(() => document.getElementById(copyButtonId)?.focus());
});
</script>

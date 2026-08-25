<template>
    <div class="pl-5 pb-3 space-y-1 max-w-xl">
      <div class="flex items-center gap-3">
        <ToggleSwitch
          :model-value="agent.encryptPayload"
          :disabled="!canEdit || !agent.supportsEncryptedPayload"
          :title="t('agents.encryptPayload')"
          @update:model-value="handleToggle"
        />
        <p class="text-sm text-text-primary">
          {{ t('agents.encryptPayload') }}
        </p>
      </div>
      <p class="text-xs text-text-secondary">
        {{ t('agents.encryptPayloadHint') }}
      </p>
      <p
        v-if="!agent.supportsEncryptedPayload"
        class="text-xs text-status-warning"
      >
        {{ t('agents.encryptPayloadUnsupported') }}
      </p>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ToggleSwitch from '@/components/core/input/ToggleSwitch.vue';
import { useAgentStore } from '@/store/core/agent';
import { useAuthStore } from '@/store/core/auth';
import { useNotificationStore } from '@/store/ui/notifications';
import type { AgentSummary } from '@/data/agents/AgentDto';

/**
 * Per-agent payload sealing on top of mTLS. The toggle is dead unless the agent
 * has reported it can open a sealed dispatch — the scheduler would otherwise
 * fall back to plaintext with only a log line to show for it, so the operator
 * is stopped here rather than told afterwards.
 */
const props = defineProps<{
  agent: AgentSummary;
}>();

const { t } = useI18n();
const agentStore = useAgentStore();
const authStore = useAuthStore();
const notifications = useNotificationStore();

const canEdit = computed<boolean>(() => authStore.canWrite('settings'));

async function handleToggle(value: boolean) {
  const result = await agentStore.setEncryptPayload(props.agent.slug, value);
  if (!result.ok && result.message) notifications.show(result.message, 'error');
}
</script>

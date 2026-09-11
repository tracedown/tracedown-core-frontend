<template>
    <div class="pl-5 pb-3 space-y-1 max-w-xl">
      <p class="text-xs text-text-secondary">
        {{ t('agents.bodyStore.label') }}
      </p>
      <AppSelect
        :model-value="agent.bodyStoreId ?? DEFAULT_OPTION"
        class="w-64"
        :options="options"
        :disabled="!canEdit || saving"
        @update:model-value="handleChange"
      />
      <p class="text-xs text-text-secondary">
        {{ t('agents.bodyStore.hint') }}
      </p>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import AppSelect from '@/components/core/input/AppSelect.vue';
import { useAgentStore } from '@/store/core/agent';
import { useAuthStore } from '@/store/core/auth';
import { useBodyStoreStore } from '@/store/core/bodyStore';
import { useNotificationStore } from '@/store/ui/notifications';
import { bodyStoreOptions, DEFAULT_OPTION } from '@/components/settings/bodyStores/bodyStoreOptions';
import type { AgentSummary } from '@/data/agents/AgentDto';

/** Which body store one agent writes response bodies to (default first). */
const props = defineProps<{
  agent: AgentSummary;
}>();

const { t } = useI18n();
const agentStore = useAgentStore();
const authStore = useAuthStore();
const bodyStoreStore = useBodyStoreStore();
const notifications = useNotificationStore();

const canEdit = computed<boolean>(() => authStore.canWrite('settings'));
const saving = ref<boolean>(false);

const options = computed(() => bodyStoreOptions(bodyStoreStore.stores, t('agents.storage.defaultStore')));

async function handleChange(value: string | string[]) {
  if (Array.isArray(value) || saving.value) return;
  const from = props.agent.bodyStoreId ?? null;
  const to = value === DEFAULT_OPTION ? null : value;
  if (from === to) return;
  saving.value = true;
  try {
    const result = await agentStore.setBodyStore(props.agent.slug, to);
    if (!result.ok) {
      notifications.show(result.message ?? t('common.states.error'), 'error');
      return;
    }
    bodyStoreStore.moveAgent(from, to);
    notifications.show(t('agents.bodyStore.updated'), 'success');
  } finally {
    saving.value = false;
  }
}
</script>

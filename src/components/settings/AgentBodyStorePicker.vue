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
      <LinkButton
        :label-text="showSettings ? t('common.actions.hide') : t('agents.bodyStore.showSettings')"
        @click="showSettings = !showSettings"
      />
      <AgentStorageSettings
        v-if="showSettings"
        :slug="agent.slug"
        :store="assignedStore"
      />
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import AppSelect from '@/components/core/input/AppSelect.vue';
import LinkButton from '@/components/core/buttons/LinkButton.vue';
import AgentStorageSettings from '@/components/settings/AgentStorageSettings.vue';
import { useAgentStore } from '@/store/core/agent';
import { useAuthStore } from '@/store/core/auth';
import { useBodyStoreStore } from '@/store/core/bodyStore';
import { useNotificationStore } from '@/store/ui/notifications';
import { bodyStoreOptions, DEFAULT_OPTION } from '@/components/settings/bodyStores/bodyStoreOptions';
import type { AgentSummary } from '@/data/agents/AgentDto';
import type { BodyStoreSummary } from '@/data/bodyStores/BodyStoreDto';

/**
 * Which body store one agent writes response bodies to (default first).
 *
 * The assignment is only recorded here — the agent goes on writing where its
 * own environment points until it is redeployed with the settings this panel
 * prints, which is why the hint says so and the settings are one click away.
 */
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
const showSettings = ref<boolean>(false);

const options = computed(() => bodyStoreOptions(bodyStoreStore.stores, t('agents.storage.defaultStore')));

/** The row the agent is assigned to, or null for the default store. */
const assignedStore = computed<BodyStoreSummary | null>(() =>
  bodyStoreStore.stores.find(store => store.id === props.agent.bodyStoreId) ?? null);

// The default store's own kind decides what the settings look like; the panel
// may be the first thing on screen that needs it.
watch(showSettings, (open) => {
  if (open && !bodyStoreStore.defaultLoaded) void bodyStoreStore.fetchDefault();
});

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
    // The change is not live until the agent runs with the new settings, so
    // they are put on screen rather than left to be found.
    showSettings.value = true;
    notifications.show(t('agents.bodyStore.updated'), 'success');
  } finally {
    saving.value = false;
  }
}
</script>

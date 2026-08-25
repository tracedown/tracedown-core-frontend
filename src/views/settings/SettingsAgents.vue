<template>
    <div class="px-gutter py-4 space-y-8">
      <!-- Extension point: an overlay may render a scoped agents panel here (and
         hide the default fleet below via the 'agents.fleet' gate). -->
      <SlotOutlet name="agents-panel" />

      <!-- Fleet list -->
      <div
        v-if="isFeatureEnabled('agents.fleet')"
        class="space-y-3"
      >
        <div class="flex items-center justify-between">
          <SectionHeading :label="t('agents.fleet')" />
          <CreateToggleButton
            v-if="authStore.canWrite('settings')"
            v-model="connectOpen"
            :label-text="t('agents.connect')"
          />
        </div>

        <AgentConnectForm
          v-if="authStore.canWrite('settings')"
          v-model:open="connectOpen"
        />

        <LoadingState v-if="agentStore.loading && agentStore.agents.length === 0" />
        <EmptyState
          v-else-if="agentStore.agents.length === 0"
          compact
          :message="t('agents.none')"
        />
        <ul
          v-else
          class="divide-y divide-text-secondary/15 max-w-3xl"
        >
          <li
            v-for="agent in agentStore.agents"
            :key="agent.slug"
          >
            <button
              type="button"
              class="w-full flex items-center gap-3 py-2.5 text-left cursor-pointer"
              :class="{ 'opacity-50': !agent.isActive }"
              @click="expandedSlug = expandedSlug === agent.slug ? null : agent.slug"
            >
              <span
                class="w-2 h-2 rounded-full shrink-0"
                :class="healthDot(agent)"
              />
              <div class="min-w-0">
                <p class="text-sm text-text-primary truncate">
                  {{ agent.label }}
                  <span class="text-text-secondary font-mono text-xs ml-1">{{ agent.slug }}</span>
                </p>
                <p class="text-xs text-text-secondary truncate">
                  {{ agent.agentUri }}
                </p>
              </div>
              <BadgePill
                class="shrink-0"
                :color-class="HEALTH_PILL[agentEffectiveHealth(agent)]"
                :label="t(`agents.health.${agentEffectiveHealth(agent)}`)"
              />
              <span class="text-xs text-text-secondary ml-auto shrink-0">
                {{ lastPingLabel(agent) }}
              </span>
              <ToggleSwitch
                :model-value="agent.isActive"
                class="shrink-0"
                :title="agent.isActive ? t('agents.deactivate') : t('agents.activate')"
                @click.stop
                @update:model-value="(value: boolean) => handleToggle(agent, value)"
              />
            </button>

            <template v-if="expandedSlug === agent.slug">
              <AgentHistoryPanel :slug="agent.slug" />
              <AgentEncryptionToggle :agent="agent" />
              <div
                v-if="authStore.canWrite('settings')"
                class="pl-5 pb-4"
              >
                <DangerButton
                  :label-text="t('agents.delete')"
                  :hold-offset-sec="3"
                  @safe-click="handleDelete(agent)"
                />
                <p class="text-xs text-text-secondary mt-1">
                  {{ t('agents.deleteHint') }}
                </p>
              </div>
            </template>
          </li>
        </ul>
      </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { isFeatureEnabled } from '@/config/extensions';
import SlotOutlet from '@/components/core/SlotOutlet.vue';
import SectionHeading from '@/components/core/SectionHeading.vue';
import LoadingState from '@/components/core/LoadingState.vue';
import EmptyState from '@/components/core/EmptyState.vue';
import BadgePill from '@/components/core/BadgePill.vue';
import AgentHistoryPanel from '@/components/settings/AgentHistoryPanel.vue';
import AgentEncryptionToggle from '@/components/settings/AgentEncryptionToggle.vue';
import DangerButton from '@/components/core/buttons/DangerButton.vue';
import AgentConnectForm from '@/components/settings/AgentConnectForm.vue';
import CreateToggleButton from '@/components/core/buttons/CreateToggleButton.vue';
import ToggleSwitch from '@/components/core/input/ToggleSwitch.vue';
import { useAgentStore } from '@/store/core/agent';
import { useAuthStore } from '@/store/core/auth';
import { useNotificationStore } from '@/store/ui/notifications';
import { agentEffectiveHealth } from '@/data/agents/AgentDto';
import { useRelativeTime } from '@/composables/useRelativeTime';
import { useLiveChannel } from '@/requests';
import { agentHealthChannel, onAgentHealthEvent } from '@/data/agents/agentHealthChannel';
import type { AgentSummary, EffectiveHealth } from '@/data/agents/AgentDto';

/**
 * Probe-agent fleet tab: registered agents with live-ish health, activation
 * toggles, and one-time bootstrap-token generation for connecting new
 * agents (the UI twin of `--agent-bootstrap`).
 */
const { t } = useI18n();
const agentStore = useAgentStore();
const authStore = useAuthStore();
const notifications = useNotificationStore();
const { formatLastOnline } = useRelativeTime();

const HEALTH_PILL: Record<EffectiveHealth, string> = {
  healthy: 'bg-status-success/10 text-status-success',
  unhealthy: 'bg-status-warning/10 text-status-warning',
  down: 'bg-status-failure/10 text-status-failure',
  unknown: 'bg-text-secondary/10 text-text-secondary',
};

const expandedSlug = ref<string | null>(null);
const connectOpen = ref<boolean>(false);
function healthDot(agent: AgentSummary): string {
  if (!agent.isActive) return 'bg-text-secondary/40';
  const health = agentEffectiveHealth(agent);
  if (health === 'healthy') return 'bg-status-success';
  if (health === 'unhealthy') return 'bg-status-warning';
  if (health === 'down') return 'bg-status-failure';
  return 'bg-text-secondary/40';
}

function lastPingLabel(agent: AgentSummary): string {
  if (!agent.lastPing) return t('agents.never');
  return `${t('agents.lastCheck')}: ${formatLastOnline(agent.lastPing)}`;
}

async function handleToggle(agent: AgentSummary, value: boolean) {
  const result = await agentStore.setActive(agent.slug, value);
  if (!result.ok && result.message) notifications.show(result.message, 'error');
}

async function handleDelete(agent: AgentSummary) {
  const result = await agentStore.deleteAgent(agent.slug);
  if (!result.ok) {
    if (result.message) notifications.show(result.message, 'error');
    return;
  }
  expandedSlug.value = null;
  notifications.show(t('agents.deleted'), 'success');
}

onMounted(() => {
  void agentStore.fetchAgents();
});

// Live health feed (same channel as the headbar indicator): known agents get
// their status patched in place; an unknown slug means a NEW agent finished
// bootstrapping — refetch the list for its full row.
const { state: healthState } = useLiveChannel(agentHealthChannel, undefined, { onEvent: onAgentHealthEvent });

watch(() => healthState.value?.statuses, (statuses) => {
  if (!statuses || statuses.length === 0 || agentStore.loading) return;
  const known = new Set(agentStore.agents.map(a => a.slug));
  if (statuses.some(s => !known.has(s.agentSlug))) {
    void agentStore.fetchAgents();
    return;
  }
  agentStore.applyHealth(statuses);
}, { deep: true });
</script>

<template>
    <DropdownPanel
      v-if="state"
      align-right
      panel-class="w-72"
    >
      <template #trigger="{ toggle }">
        <button
          class="flex items-center gap-2 px-3 max-md:px-2 py-1.5 rounded-lg text-sm transition-colors hover:bg-background-primary"
          :class="summaryClass"
          :title="summaryText"
          @click="toggle"
        >
          <FontAwesomeIcon :icon="faHeartPulse" class="w-3.5 h-3.5" />
          <!--  On a phone the bar has no room for the count — the pulse icon
                keeps its status colour and the panel carries the detail.  -->
          <span class="max-md:hidden">{{ summaryText }}</span>
        </button>
      </template>

      <div
        v-if="agents.length === 0"
        class="px-4 py-3 text-sm text-text-secondary"
      >
        {{ t('agents.noProbes') }}
      </div>

      <div
        v-for="agent in agents"
        :key="agent.agentSlug"
        class="px-4 py-2.5 border-b border-text-secondary/50 last:border-0"
      >
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <FontAwesomeIcon :icon="faServer" class="w-3 h-3 text-text-secondary" />
              <span class="text-sm font-medium text-text-primary">
                {{ agent.agentSlug }}
              </span>
            </div>

            <span
              class="text-xs font-medium px-1.5 py-0.5 rounded"
              :class="HEALTH_BADGE[effectiveHealth(agent)]"
            >
              {{ t(`agents.health.${effectiveHealth(agent)}`) }}
            </span>
          </div>

          <div class="flex items-center justify-between">
            <div class="text-xs text-text-secondary">
              {{ t('agents.lastCheck') }}: {{ formatLastCheck(agent.lastCheck) }}
            </div>

            <div>
              <p
                v-if="effectiveHealth(agent) !== 'down' && agent.lastResponseMs != null"
                class="text-xs text-text-secondary mt-0.5"
              >
                {{ agent.lastResponseMs }}ms
              </p>
            </div>
          </div>
        </div>
      </div>
    </DropdownPanel>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faHeartPulse, faServer } from '@fortawesome/free-solid-svg-icons';
import DropdownPanel from '@/components/core/DropdownPanel.vue';
import { useLiveChannel } from '@/requests';
import { agentHealthChannel, onAgentHealthEvent } from '@/data/agents/agentHealthChannel';
import { effectiveHealth, type AgentStatus, type EffectiveHealth } from '@/data/agents/AgentDto';
import { tickFast } from '@/lib/timeTick';

const { t } = useI18n();

const { state } = useLiveChannel(agentHealthChannel, undefined, { onEvent: onAgentHealthEvent });

const agents = computed<AgentStatus[]>(() => state.value?.statuses ?? []);

const healthyCount = computed(() =>
  agents.value.filter(a => effectiveHealth(a) === 'healthy').length);

const summaryText = computed(() => {
  if (agents.value.length === 0) return t('agents.noProbes');
  return t('agents.healthySummary', { healthy: healthyCount.value, total: agents.value.length });
});

const summaryClass = computed(() => {
  if (agents.value.length === 0) return 'text-text-secondary';
  if (healthyCount.value === agents.value.length) return 'text-status-success';
  if (healthyCount.value === 0) return 'text-status-failure';
  return 'text-status-warning';
});

const HEALTH_BADGE: Record<EffectiveHealth, string> = {
  healthy: 'bg-status-success/20 text-status-success',
  unhealthy: 'bg-status-warning/20 text-status-warning',
  down: 'bg-status-failure/20 text-status-failure',
  unknown: 'bg-text-secondary/50 text-text-secondary',
};

function formatLastCheck(lastCheck: string | null): string {
  void tickFast.value; // recalculates every 5s
  if (!lastCheck) return t('agents.never');
  const date = new Date(lastCheck);
  if (isNaN(date.getTime())) return lastCheck;
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60000) return t('common.time.secondsAgo', { n: Math.floor(diffMs / 1000) });
  if (diffMs < 3600000) return t('common.time.minutesAgo', { n: Math.floor(diffMs / 60000) });
  return t('common.time.hoursAgo', { n: Math.floor(diffMs / 3600000) });
}
</script>

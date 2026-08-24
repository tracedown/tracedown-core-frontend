<template>
    <ResourcePage
      v-if="workspace"
      :key="workspaceId"
      :title="workspace.name"
      :tabs="tabs"
    >
      <template #title-actions>
        <SilenceBell
          resource-type="workspace"
          :resource-id="workspaceId"
        />
      </template>
      <template #title-controls>
        <ScopedServiceToggle
          v-if="canManage"
          scope="workspace"
          :scope-id="workspaceId"
        />
      </template>
      <template #stats>
        <ResourceWindowStats
          :history="metricsStore.history"
          :loading="metricsStore.historyLoading"
          :static-stats="[
            { label: t('common.entities.projects'), value: wsMetrics?.projectCount ?? projectStore.totalResults },
            { label: t('common.entities.services'), value: wsMetrics?.serviceCount ?? pagedServiceCount },
          ]"
        />
      </template>

      <template #overview>
        <WorkspaceOverview />
      </template>
      <template #variables>
        <WorkspaceVariables />
      </template>
      <template #usage>
        <UsageTab
          scope="workspaces"
          :resource-id="workspaceId"
        />
      </template>
      <template #users>
        <div class="px-gutter py-6">
          <ResourceAccessTab
            resource-type="workspace"
            :resource-id="workspaceId"
          />
        </div>
      </template>
      <template #settings>
        <WorkspaceSettings />
      </template>
    </ResourcePage>
    <LoadingState v-else />
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { faChartArea, faGauge, faGear, faKey, faUsers } from '@fortawesome/free-solid-svg-icons';
import ResourcePage from '@/components/resource/ResourcePage.vue';
import UsageTab from '@/components/resource/usage/UsageTab.vue';
import ResourceWindowStats from '@/components/resource/ResourceWindowStats.vue';
import { useLiveChannel } from '@/requests';
import { workspaceChannel } from '@/data/workspaces/workspaceChannel';
import { useVariableStore } from '@/store/core/variable';
import { useSearchStore } from '@/store/ui/search';
import WorkspaceOverview from '@/views/workspace/WorkspaceOverview.vue';
import WorkspaceVariables from '@/views/workspace/WorkspaceVariables.vue';
import WorkspaceSettings from '@/views/workspace/WorkspaceSettings.vue';
import { useAuthStore } from '@/store/core/auth';
import { useWorkspaceStore } from '@/store/core/workspace';
import { useProjectStore } from '@/store/core/project';
import { useMetricsStore } from '@/store/core/metrics';
import { useNavigationStore } from '@/store/ui/navigation';
import type { DisplayTab } from '@/types/ui/tabs';
import LoadingState from '@/components/core/LoadingState.vue';
import ResourceAccessTab from '@/components/resource/access/ResourceAccessTab.vue';
import SilenceBell from '@/components/core/notifications/SilenceBell.vue';
import ScopedServiceToggle from '@/components/service/ScopedServiceToggle.vue';

const { t } = useI18n();
const route = useRoute();
const authStore = useAuthStore();
const workspaceStore = useWorkspaceStore();
const projectStore = useProjectStore();
const metricsStore = useMetricsStore();
const navigationStore = useNavigationStore();
const variableStore = useVariableStore();
const searchStore = useSearchStore();

const workspaceId = computed(() => route.params.workspaceId as string);
const workspace = computed(() =>
  workspaceStore.workspaces.find(w => w.id === workspaceId.value) ?? null);

// Page-local fallback until the metrics response (authoritative, backend-
// counted over the full accessible set) arrives.
const pagedServiceCount = computed(() =>
  projectStore.projects.reduce((sum, p) => sum + (p.serviceCount ?? 0), 0));

// Live workspace channel: project CRUD by other users silently refreshes the
// list; workspace-variable changes refresh the variables tab if it's showing.
// In polling mode the metrics state refreshes on cadence.
const { state: wsMetrics } = useLiveChannel(workspaceChannel, () => workspaceId.value, {
  onEvent: (event) => {
    switch (event.type) {
      case 'project.created':
      case 'project.deleted':
      case 'project.updated':
        void projectStore.fetchProjects(workspaceId.value, searchStore.currentValue || undefined, {
          silent: true,
          force: true,
        });
        break;
      case 'variable.changed':
        variableStore.refreshIfCurrent('workspaces', event.data.resourceId);
        break;
      case 'metrics.delta':
        // Aggregated probe roll-up — ticks the header stats/chart and the
        // project-card grid live.
        metricsStore.recordDelta('workspaces', workspaceId.value, event.data);
        for (const [projId, delta] of Object.entries(event.data.projects ?? {})) {
          projectStore.applyMetricsDelta(projId, delta);
        }
        break;
    }
  },
});

/** Org-wide workspace write, ownership, or a write grant on this workspace. */
const canManage = computed(() =>
  authStore.canWriteScoped([`workspace::${workspaceId.value}`]));

const tabs = computed<DisplayTab[]>(() => [
  { key: 'overview', label: t('common.labels.overview'), icon: faGauge },
  { key: 'variables', label: t('common.labels.variables'), icon: faKey },
  { key: 'users', label: t('nav.users'), icon: faUsers, visible: canManage.value },
  { key: 'settings', label: t('common.labels.settings'), icon: faGear, visible: canManage.value },
  { key: 'usage', label: t('usage.title'), icon: faChartArea, visible: canManage.value },
]);

// Loads the workspace (direct URL navigation 404s to resource-not-found),
// its projects and the header metrics whenever the route param changes.
// Store-level caching makes revisits and tab switches free.
watch(workspaceId, async (id) => {
  if (!id) return;
  // Fast navigation can leave this continuation running for a workspace the
  // user already left — bail after each await so a stale run never selects
  // or fetches over the current workspace's state.
  const stale = () => route.params.workspaceId !== id;
  navigationStore.clearBreadcrumbs();
  // Synchronous stale-data reset before the first render of the new context —
  // the view starts at zero and fills exactly once, with the actual data.
  projectStore.ensureContext(id);
  metricsStore.ensureContext('workspaces', id);

  if (!workspaceStore.workspaces.find(w => w.id === id)) {
    await workspaceStore.fetchWorkspace(id);
    if (stale()) return;
  }
  workspaceStore.setSelectedWorkspace(id);

  await projectStore.fetchProjects(id);
  if (stale()) return;
  // Background — can take seconds on large fleets; the chart spinner covers it.
  void metricsStore.fetchHistory('workspaces', id);
}, { immediate: true });
</script>

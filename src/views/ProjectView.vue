<template>
    <ResourcePage
      v-if="project"
      :key="projectId"
      :title="project.name"
      :tabs="tabs"
    >
      <template #title-actions>
        <SilenceBell
          resource-type="project"
          :resource-id="projectId"
          :parent-keys="project ? [`workspace::${project.workspaceId}`] : []"
        />
      </template>
      <template #title-controls>
        <ScopedServiceToggle
          v-if="canManage"
          scope="project"
          :scope-id="projectId"
        />
      </template>
      <template #stats>
        <ResourceWindowStats
          :history="metricsStore.history"
          :loading="metricsStore.historyLoading"
          :static-stats="[
            { label: t('common.entities.services'), value: projMetrics?.serviceCount ?? serviceStore.totalResults },
          ]"
        />
      </template>

      <template #overview>
        <ProjectOverview />
      </template>
      <template #variables>
        <ProjectVariables />
      </template>
      <template #usage>
        <UsageTab
          scope="projects"
          :resource-id="projectId"
        />
      </template>
      <template #users>
        <div class="px-gutter py-6">
          <ResourceAccessTab
            resource-type="project"
            :resource-id="projectId"
          />
        </div>
      </template>
      <template #settings>
        <ProjectSettings />
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
import ProjectOverview from '@/views/project/ProjectOverview.vue';
import ProjectVariables from '@/views/project/ProjectVariables.vue';
import ProjectSettings from '@/views/project/ProjectSettings.vue';
import { useLiveChannel } from '@/requests';
import { projectChannel } from '@/data/projects/projectChannel';
import { applyProbeToMetrics } from '@/lib/metrics-utils';
import { useAuthStore } from '@/store/core/auth';
import { useWorkspaceStore } from '@/store/core/workspace';
import { useProjectStore } from '@/store/core/project';
import { useServiceStore } from '@/store/core/service';
import { useMetricsStore } from '@/store/core/metrics';
import { useVariableStore } from '@/store/core/variable';
import { useNavigationStore } from '@/store/ui/navigation';
import { useSearchStore } from '@/store/ui/search';
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
const serviceStore = useServiceStore();
const metricsStore = useMetricsStore();
const variableStore = useVariableStore();
const navigationStore = useNavigationStore();
const searchStore = useSearchStore();

const projectId = computed(() => route.params.projectId as string);
const project = computed(() =>
  projectStore.projects.find(p => p.id === projectId.value) ?? null);

// Live project channel: probe.completed patches the roll-up metrics locally
// and folds the result into the service list; created/updated/deleted trigger
// a silent list refresh. In polling mode the state refreshes on cadence.
const { state: projMetrics } = useLiveChannel(projectChannel, () => projectId.value, {
  onEvent: (event, current) => {
    if (event.type === 'probe.completed') {
      serviceStore.applyProbeResult(event.data.serviceId, event.data.status, event.data.avgResponseMs, event.data.failedAssertions);
      // Tick the header stats/chart bucket live (interval refetch trues it up).
      metricsStore.recordProbe('projects', projectId.value, event.data.status, event.data.avgResponseMs, event.data.callCount ?? 1);
      return applyProbeToMetrics(current, event.data.status, event.data.avgResponseMs);
    }
    if (event.type === 'service.created' || event.type === 'service.deleted') {
      void serviceStore.fetchServices(projectId.value, searchStore.currentValue || undefined, {
        silent: true,
        force: true,
      });
    }
    if (event.type === 'service.updated') {
      void serviceStore.refreshService(event.data.serviceId);
    }
    if (event.type === 'variable.changed') {
      variableStore.refreshIfCurrent('projects', event.data.resourceId);
    }
  },
});

/** Write via org section, ownership, or a grant on the project/workspace. */
const canManage = computed(() =>
  authStore.canWriteScoped([
    `project::${projectId.value}`,
    ...(project.value ? [`workspace::${project.value.workspaceId}`] : []),
  ]));

const tabs = computed<DisplayTab[]>(() => [
  { key: 'overview', label: t('common.labels.overview'), icon: faGauge },
  { key: 'variables', label: t('common.labels.variables'), icon: faKey },
  { key: 'users', label: t('nav.users'), icon: faUsers, visible: canManage.value },
  { key: 'settings', label: t('common.labels.settings'), icon: faGear, visible: canManage.value },
  { key: 'usage', label: t('usage.title'), icon: faChartArea, visible: canManage.value },
]);

const breadcrumbs = computed(() => {
  const parent = project.value
    ? workspaceStore.workspaces.find(w => w.id === project.value?.workspaceId)
    : null;
  if (!parent) return [];
  return [{
    label: parent.name,
    to: { name: 'workspace', params: { workspaceId: parent.id } },
  }];
});

watch(breadcrumbs, (value) => navigationStore.setBreadcrumbs(value), { immediate: true });

// Loads the project (direct URL navigation 404s to resource-not-found), its
// services and the header history whenever the route param changes.
// Store-level caching makes revisits and tab switches free.
watch(projectId, async (id) => {
  if (!id) return;
  // Fast navigation can leave this continuation running for a project the
  // user already left — bail after each await so a stale run never fetches
  // over the current project's state.
  const stale = () => route.params.projectId !== id;
  // Synchronous stale-data reset before the first render of the new context —
  // the view starts at zero and fills exactly once, with the actual data.
  serviceStore.ensureContext(id);
  metricsStore.ensureContext('projects', id);

  if (!projectStore.projects.find(p => p.id === id)) {
    await projectStore.fetchProject(id);
    if (stale()) return;
  }
  // A deep link can arrive with another workspace persisted — the header
  // selects belong to the project actually open.
  if (project.value) workspaceStore.setSelectedWorkspace(project.value.workspaceId);

  await serviceStore.fetchServices(id);
  if (stale()) return;
  // Background — can take seconds on large fleets; the chart spinner covers it.
  void metricsStore.fetchHistory('projects', id);
}, { immediate: true });
</script>

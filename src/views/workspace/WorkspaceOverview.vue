<template>
    <div class="px-gutter py-6">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-semibold text-text-primary">
            {{ t('common.entities.projects') }}
          </h2>
          <SlotOutlet
            name="resource-meta"
            :slot-props="{ resource: 'projects' }"
          />
        </div>
        <CreateToggleButton
          v-if="canEditWorkspace"
          v-model="showCreateForm"
          :label-text="t('project.createNew')"
          :disabled="!isFeatureEnabled('project.create')"
          :hint="t('common.actionUnavailable')"
        />
      </div>

      <InlineCreateForm
        v-if="showCreateForm"
        :title="t('project.createTitle')"
        :placeholder="t('project.namePlaceholder')"
        @create="handleCreateProject"
      />

      <LoadingState v-if="projectStore.loading" />

      <EmptyState
        v-else-if="projectStore.projects.length === 0"
        :icon="faFolderOpen"
        :message="t('project.noProjects')"
        :description="t('project.noProjectsDescription')"
      />

      <template v-else>
        <div class="grid grid-cols-3 md:grid-cols-4 gap-4">
          <ProjectCard
            v-for="project in projectStore.projects"
            :key="project.id"
            :project="project"
          />
        </div>
        <div class="flex justify-center mt-6">
          <TablePager
            :page="projectStore.page"
            :page-size="projectStore.pageSize"
            :total="projectStore.totalResults"
            @change="handlePageChange"
          />
        </div>
      </template>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { isFeatureEnabled } from '@/config/extensions';
import { faFolderOpen } from '@fortawesome/free-solid-svg-icons';
import CreateToggleButton from '@/components/core/buttons/CreateToggleButton.vue';
import SlotOutlet from '@/components/core/SlotOutlet.vue';
import EmptyState from '@/components/core/EmptyState.vue';
import InlineCreateForm from '@/components/resource/InlineCreateForm.vue';
import ProjectCard from '@/components/project/ProjectCard.vue';
import TablePager from '@/components/core/TablePager.vue';
import { useAuthStore } from '@/store/core/auth';
import { useProjectStore } from '@/store/core/project';
import { useNotificationStore } from '@/store/ui/notifications';
import { useSearchStore } from '@/store/ui/search';
import { useResourceSearch } from '@/composables/useResourceSearch';
import LoadingState from '@/components/core/LoadingState.vue';

const { t } = useI18n();
const route = useRoute();
const authStore = useAuthStore();
const projectStore = useProjectStore();
const notifications = useNotificationStore();
const searchStore = useSearchStore();

const workspaceId = computed(() => route.params.workspaceId as string);
const canEditWorkspace = computed(() =>
  authStore.canWriteScoped([`workspace::${workspaceId.value}`]));
const showCreateForm = ref<boolean>(false);

// Silent — see ProjectOverview: a per-keystroke refetch must not flash the
// full-screen loading overlay over the grid it is filtering.
useResourceSearch((value) => {
  void projectStore.fetchProjects(workspaceId.value, value || undefined, { silent: true });
});

// Store-cached: a no-op unless a stale search filter is still applied.
onMounted(() => {
  void projectStore.fetchProjects(workspaceId.value);
});

function handlePageChange(newPage: number) {
  void projectStore.fetchProjects(workspaceId.value, searchStore.currentValue || undefined, {
    page: newPage,
    force: true,
  });
}

async function handleCreateProject(name: string) {
  const result = await projectStore.createProject({ workspaceId: workspaceId.value, name });
  if (!result.ok) {
    if (result.message) notifications.show(result.message, 'error');
    return;
  }
  showCreateForm.value = false;
}
</script>

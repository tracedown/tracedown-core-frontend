<template>
    <div class="px-gutter py-4 space-y-8">
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <SectionHeading :label="t('settings.notificationTemplates')" />
          <CreateToggleButton
            v-if="canManage"
            v-model="createOpen"
            :label-text="t('templates.create')"
          />
        </div>
        <p class="text-sm text-text-secondary max-w-2xl">
          {{ t('templates.pageHint') }}
        </p>

        <div
          v-if="createOpen"
          class="max-w-2xl"
        >
          <form
            v-if="createOpen"
            class="space-y-3"
            @submit.prevent="handleCreate"
          >
            <div>
              <p class="text-xs text-text-secondary mb-1">
                {{ t('templates.name') }}
              </p>
              <TextInput
                v-model="newName"
                class="w-64"
                compact
                :placeholder="t('templates.namePlaceholder')"
              />
            </div>
            <div>
              <p class="text-xs text-text-secondary mb-1">
                {{ t('templates.text') }}
              </p>
              <TextArea
                v-model="newText"
                :rows="3"
                :placeholder="t('templates.textPlaceholder')"
              />
              <p class="text-xs text-text-secondary mt-1">
                {{ t('templates.varsHint') }}
              </p>
            </div>
            <PrimaryButton
              type="submit"
              :label-text="t('common.actions.create')"
              :loading="creating"
              :disabled="!newName.trim() || !newText.trim()"
            />
          </form>
        </div>

        <div class="flex items-end gap-2 max-md:flex-col max-md:items-stretch">
          <div>
            <p class="text-xs text-text-secondary mb-1">
              {{ t('templates.filterByProject') }}
            </p>
            <AppSelect
              v-model="projectFilter"
              class="w-64"
              searchable
              :options="filterOptions"
            />
          </div>
        </div>

        <LoadingState v-if="templateStore.loading && templateStore.templates.length === 0" />
        <EmptyState
          v-else-if="filteredTemplates.length === 0"
          compact
          :message="t('templates.none')"
        />
        <ResponsiveTable
          v-else
          :columns="columns"
          :rows="filteredTemplates"
          :row-key="(template: NotificationTemplateSummary) => template.id"
          :expanded-key="expandedId"
          table-class="table-fixed max-w-4xl"
        >
          <template #cell:name="{ row }">
            {{ row.name }}
          </template>
          <template #cell:text="{ row }">
            {{ row.text }}
          </template>
          <template #cell:projects="{ row }">
            <div class="flex flex-wrap gap-1 max-md:justify-end">
              <BadgePill
                v-for="projectName in projectNames(row).slice(0, 3)"
                :key="projectName"
                color-class="bg-text-secondary/10 text-text-secondary"
                :label="projectName"
              />
              <BadgePill
                v-if="projectNames(row).length > 3"
                color-class="bg-text-secondary/10 text-text-secondary"
                :label="`+${projectNames(row).length - 3}`"
              />
              <span
                v-if="projectNames(row).length === 0"
                class="text-xs text-text-secondary italic"
              >
                {{ t('templates.noneBoundShort') }}
              </span>
            </div>
          </template>
          <template
            v-if="canManage"
            #actions="{ row }"
          >
            <div class="flex items-center gap-1 justify-end">
              <IconButton
                :fa-icon="faPen"
                :title="t('common.actions.edit')"
                color-class="text-text-secondary hover:text-accent-primary"
                icon-class="w-3.5 h-3.5"
                @click="expandedId = expandedId === row.id ? null : row.id"
              />
              <IconButton
                :fa-icon="faTrash"
                :title="t('common.actions.delete')"
                color-class="text-text-secondary hover:text-status-failure"
                icon-class="w-3.5 h-3.5"
                :hold-offset-sec="3"
                @safe-click="handleDelete(row)"
              />
            </div>
          </template>
          <template #expanded="{ row }">
            <div class="px-3 pb-4 max-md:pt-2">
              <NotificationTemplateRow
                :template="row"
                :projects="projects"
                @toggle="expandedId = null"
                @bind="(projectId: string) => handleBind(row.id, projectId)"
                @unbind="(projectId: string) => handleUnbind(row.id, projectId)"
              />
            </div>
          </template>
        </ResponsiveTable>

        <TablePager
          :page="templateStore.page"
          :page-size="50"
          :total="templateStore.total"
          @change="(p: number) => templateStore.fetchTemplates(p)"
        />
      </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { faPen, faTrash } from '@fortawesome/free-solid-svg-icons';
import SectionHeading from '@/components/core/SectionHeading.vue';
import LoadingState from '@/components/core/LoadingState.vue';
import EmptyState from '@/components/core/EmptyState.vue';
import BadgePill from '@/components/core/BadgePill.vue';
import IconButton from '@/components/core/buttons/IconButton.vue';
import CreateToggleButton from '@/components/core/buttons/CreateToggleButton.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import TextInput from '@/components/core/input/TextInput.vue';
import TextArea from '@/components/core/input/TextArea.vue';
import AppSelect from '@/components/core/input/AppSelect.vue';
import ResponsiveTable from '@/components/core/ResponsiveTable.vue';
import TablePager from '@/components/core/TablePager.vue';
import NotificationTemplateRow from '@/components/settings/NotificationTemplateRow.vue';
import { useNotificationTemplateStore } from '@/store/core/notificationTemplate';
import { useWorkspaceStore } from '@/store/core/workspace';
import { useAuthStore } from '@/store/core/auth';
import { useNotificationStore } from '@/store/ui/notifications';
import type { NotificationTemplateSummary } from '@/data/notifications/NotificationTemplateDto';
import type { ProjectSummary } from '@/data/projects/ProjectDto';
import type { DataColumn } from '@/types/ui/table';
import type { SelectOption } from '@/types/ui/common';

/**
 * Org notification templates: the ${var} texts referenced by Lace scripts
 * as template("name"). Bindings control which projects see each template.
 * Gated by the org-level `notifications` permission section.
 */
const { t } = useI18n();
const templateStore = useNotificationTemplateStore();
const workspaceStore = useWorkspaceStore();
const authStore = useAuthStore();
const notifications = useNotificationStore();

const canManage = computed(() => authStore.canWrite('notifications'));

const expandedId = ref<string | null>(null);
const projectFilter = ref<string>('');

// The template name is the headline of the mobile card; the text and the
// bindings become its labelled rows.
const columns = computed<DataColumn[]>(() => [
  { key: 'name', label: t('templates.name'), headerClass: 'w-44', cellClass: 'text-sm text-text-primary truncate align-top', primary: true },
  { key: 'text', label: t('templates.text'), cellClass: 'text-xs text-text-secondary font-mono truncate align-top' },
  { key: 'projects', label: t('templates.boundProjects'), headerClass: 'w-64', cellClass: 'align-top' },
]);

function projectNames(template: NotificationTemplateSummary): string[] {
  return template.projectIds.map(id =>
    projects.value.find(p => p.id === id)?.name ?? id);
}

const filterOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('templates.allProjects') },
  { value: 'unbound', label: t('templates.unboundOnly') },
  ...projects.value.map(p => ({ value: p.id, label: p.name })),
]);

// Server-side (PFS) filtering — re-query on change.
watch(projectFilter, (value) => {
  void templateStore.fetchTemplates(1, value || null);
});

const filteredTemplates = computed(() => templateStore.templates);
const createOpen = ref<boolean>(false);
const newName = ref<string>('');
const newText = ref<string>('');
const creating = ref<boolean>(false);
const projects = ref<ProjectSummary[]>([]);

async function handleCreate() {
  if (creating.value) return;
  creating.value = true;
  try {
    const result = await templateStore.createTemplate({
      name: newName.value.trim(),
      text: newText.value.trim(),
    });
    if (!result.ok) {
      notifications.show(result.message ?? t('common.states.error'), 'error');
      return;
    }
    newName.value = '';
    newText.value = '';
    createOpen.value = false;
  } finally {
    creating.value = false;
  }
}

async function handleDelete(template: NotificationTemplateSummary) {
  const result = await templateStore.deleteTemplate(template.id);
  if (!result.ok && result.message) notifications.show(result.message, 'error');
}

async function handleBind(templateId: string, projectId: string) {
  const result = await templateStore.bindProject(templateId, projectId);
  if (!result.ok && result.message) notifications.show(result.message, 'error');
}

async function handleUnbind(templateId: string, projectId: string) {
  const result = await templateStore.unbindProject(templateId, projectId);
  if (!result.ok && result.message) notifications.show(result.message, 'error');
}

onMounted(async () => {
  // Fetch with this component's filter explicitly — the store remembers the
  // last filter app-lifetime, but the dropdown resets on remount and the two
  // must never disagree.
  void templateStore.fetchTemplates(1, projectFilter.value || null);
  if (workspaceStore.workspaces.length === 0) {
    await workspaceStore.fetchWorkspaces();
  }
  projects.value = await templateStore.fetchAllProjects(
    workspaceStore.workspaces.map(w => w.id)
  );
});
</script>

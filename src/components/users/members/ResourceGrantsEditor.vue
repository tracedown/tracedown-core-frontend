<template>
    <div>
      <SectionHeading class="mb-2" :label="t('permissions.resourceTitle')" />

      <p
        v-if="grants.length === 0"
        class="text-xs text-text-secondary italic mb-2"
      >
        {{ t('permissions.noGrants') }}
      </p>

      <AccessLevelRow
        v-for="grant in grants"
        :key="`${grant.resourceType}:${grant.resourceId}`"
        :permissions="grant.permissions"
        @set-level="setLevel(grant, $event)"
        @remove="removeGrant(grant)"
      >
        <BadgePill
          class="shrink-0"
          :label="t(`permissions.types.${grant.resourceType}`)"
        />
        <span class="text-text-primary truncate">
          {{ resourceNameStore.nameOf(grant.resourceType, grant.resourceId) ?? grant.resourceId }}
        </span>
      </AccessLevelRow>

      <!-- Add grant: type → workspace → project → service cascade -->
      <div class="flex flex-wrap items-center gap-2 mt-3 max-md:flex-col max-md:items-stretch">
        <AppSelect
          v-model="newType"
          class="w-32"
          :options="typeOptions"
        />
        <AppSelect
          v-model="pickedWorkspace"
          class="w-40"
          :options="workspaceOptions"
        />
        <AppSelect
          v-if="newType !== 'workspace'"
          v-model="pickedProject"
          class="w-40"
          :options="projectOptions"
        />
        <AppSelect
          v-if="newType === 'service'"
          v-model="pickedService"
          class="w-40"
          :options="serviceOptions"
        />
        <AppSelect
          v-model="newLevel"
          class="w-24"
          :options="levelOptions"
        />
        <PrimaryButton
          :label-text="t('common.actions.add')"
          :disabled="!newResourceId"
          :on-click="addGrant"
        />
      </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import AppSelect from '@/components/core/input/AppSelect.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import { useOrgUserStore } from '@/store/core/orgUser';
import { useResourceNameStore } from '@/store/core/resourceName';
import { useNotificationStore } from '@/store/ui/notifications';
import type { GrantResourceType, ResourceGrant } from '@/data/orgs/PermissionDto';
import type { SelectOption } from '@/types/ui/common';
import SectionHeading from '@/components/core/SectionHeading.vue';
import AccessLevelRow from '@/components/common/AccessLevelRow.vue';
import BadgePill from '@/components/core/BadgePill.vue';

/**
 * Per-resource permission grants of one member. Every mutation PATCHes the
 * full grant list (the backend syncs diff-based) and re-renders from the
 * server's response.
 */
const props = defineProps<{
  userId: string;
}>();

const { t } = useI18n();
const orgUserStore = useOrgUserStore();
const resourceNameStore = useResourceNameStore();
const notifications = useNotificationStore();

const grants = ref<ResourceGrant[]>([]);

const newType = ref<string>('workspace');
const newLevel = ref<string>('1');
const pickedWorkspace = ref<string>('');
const pickedProject = ref<string>('');
const pickedService = ref<string>('');
const workspaceOptions = ref<SelectOption[]>([]);
const projectOptions = ref<SelectOption[]>([]);
const serviceOptions = ref<SelectOption[]>([]);

const typeOptions = computed<SelectOption[]>(() => [
  { value: 'workspace', label: t('permissions.types.workspace') },
  { value: 'project', label: t('permissions.types.project') },
  { value: 'service', label: t('permissions.types.service') },
]);

const levelOptions = computed<SelectOption[]>(() => [
  { value: '1', label: t('permissions.read') },
  { value: '2', label: t('permissions.write') },
]);

/** The id the new grant targets, depending on how deep the cascade goes. */
const newResourceId = computed(() => {
  if (newType.value === 'workspace') return pickedWorkspace.value;
  if (newType.value === 'project') return pickedProject.value;
  return pickedService.value;
});

function resolveNames(list: ResourceGrant[]) {
  for (const grant of list) {
    resourceNameStore.ensure(grant.resourceType, grant.resourceId);
  }
}

async function save(next: ResourceGrant[]) {
  const result = await orgUserStore.updateUserResources(props.userId, next);
  if (!result.ok || !result.data) {
    if (result.message) notifications.show(result.message, 'error');
    return;
  }
  grants.value = result.data;
  resolveNames(grants.value);
  notifications.show(t('users.permissionsUpdated'), 'success');
}

function setLevel(grant: ResourceGrant, level: number) {
  void save(grants.value.map(g => g === grant ? { ...g, permissions: level } : g));
}

function removeGrant(grant: ResourceGrant) {
  void save(grants.value.filter(g => g !== grant));
}

function addGrant() {
  const id = newResourceId.value;
  if (!id) return;
  const type = newType.value as GrantResourceType;
  const rest = grants.value.filter(g => !(g.resourceType === type && g.resourceId === id));
  void save([...rest, { resourceType: type, resourceId: id, permissions: Number(newLevel.value) }]);
}

// ── Cascade loading ──

watch(pickedWorkspace, async (workspaceId) => {
  pickedProject.value = '';
  projectOptions.value = [];
  if (workspaceId && newType.value !== 'workspace') {
    const result = await resourceNameStore.listProjectOptions(workspaceId);
    projectOptions.value = result.data ?? [];
  }
});

watch([pickedProject, newType], async ([projectId]) => {
  pickedService.value = '';
  serviceOptions.value = [];
  if (projectId && newType.value === 'service') {
    const result = await resourceNameStore.listServiceOptions(projectId);
    serviceOptions.value = result.data ?? [];
  }
});

watch(newType, async () => {
  // Re-trigger the project load when the type starts needing it.
  if (pickedWorkspace.value && newType.value !== 'workspace' && projectOptions.value.length === 0) {
    const result = await resourceNameStore.listProjectOptions(pickedWorkspace.value);
    projectOptions.value = result.data ?? [];
  }
});

onMounted(async () => {
  const permissions = await orgUserStore.fetchUserPermissions(props.userId);
  if (permissions.ok && permissions.data) {
    grants.value = permissions.data.resources;
    resolveNames(grants.value);
  } else if (permissions.message) {
    notifications.show(permissions.message, 'error');
  }

  const workspaces = await resourceNameStore.listWorkspaceOptions();
  workspaceOptions.value = workspaces.data ?? [];
});
</script>

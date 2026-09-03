<template>
    <div>
      <p class="text-xs text-text-secondary mb-4">
        {{ t('access.hint') }}
      </p>

      <LoadingState v-if="accessStore.loading" />
      <div
        v-else
        class="grid grid-cols-2 gap-8 max-md:grid-cols-1 max-md:gap-6"
      >
        <PillPicker
          :title="t('groups.title')"
          :available="availableGroups"
          :assigned="groupItems"
          :search-placeholder="t('groups.searchPlaceholder')"
          :add-title="t('access.grantRead')"
          :all-assigned-text="t('access.allGroupsGranted')"
          :none-assigned-text="t('access.noGroupsGranted')"
          @add="grant('group', $event, 1)"
        >
          <template #assigned>
            <AccessLevelRow
              v-for="entry in grantedGroups"
              :key="entry.principalId"
              :permissions="entry.permissions"
              :remove-title="t('access.revoke')"
              @set-level="grant('group', entry.principalId, $event)"
              @remove="revoke('group', entry.principalId)"
            >
              <span class="text-text-primary truncate">{{ entry.name }}</span>
              <span
                v-if="entry.email"
                class="text-xs text-text-secondary truncate"
              >{{ entry.email }}</span>
            </AccessLevelRow>
          </template>
        </PillPicker>

        <PillPicker
          :title="t('users.members')"
          :available="availableUsers"
          :assigned="userItems"
          :search-placeholder="t('access.searchMembers')"
          :add-title="t('access.grantRead')"
          :all-assigned-text="t('access.allUsersGranted')"
          :none-assigned-text="t('access.noUsersGranted')"
          @add="grant('user', $event, 1)"
        >
          <template #assigned>
            <AccessLevelRow
              v-for="entry in grantedUsers"
              :key="entry.principalId"
              :permissions="entry.permissions"
              :remove-title="t('access.revoke')"
              @set-level="grant('user', entry.principalId, $event)"
              @remove="revoke('user', entry.principalId)"
            >
              <span class="text-text-primary truncate">{{ entry.name }}</span>
              <span
                v-if="entry.email"
                class="text-xs text-text-secondary truncate"
              >{{ entry.email }}</span>
            </AccessLevelRow>
          </template>
        </PillPicker>
      </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import PillPicker from '@/components/core/PillPicker.vue';
import LoadingState from '@/components/core/LoadingState.vue';
import AccessLevelRow from '@/components/common/AccessLevelRow.vue';
import { useResourceAccessStore } from '@/store/core/resourceAccess';
import { useOrgUserStore } from '@/store/core/orgUser';
import { useGroupStore } from '@/store/core/group';
import { useNotificationStore } from '@/store/ui/notifications';
import type { PillItem } from '@/types/ui/common';
import type { GrantResourceType } from '@/data/orgs/PermissionDto';
import type { AccessPrincipalType, ResourceAccessEntry } from '@/data/orgs/ResourceAccessDto';

/**
 * "Users" tab of a resource: which users/groups hold a direct grant on it,
 * as two assignment cards — available principals as `+` pills in the header,
 * granted ones listed below with a level select. Adding grants Read.
 * Mounted only for viewers with write access to the resource.
 */
const props = defineProps<{
  resourceType: GrantResourceType;
  resourceId: string;
}>();

const { t } = useI18n();
const accessStore = useResourceAccessStore();
const orgUserStore = useOrgUserStore();
const groupStore = useGroupStore();
const notifications = useNotificationStore();

const grantedGroups = computed<ResourceAccessEntry[]>(() =>
  accessStore.entries.filter(e => e.principalType === 'group'));

const grantedUsers = computed<ResourceAccessEntry[]>(() =>
  accessStore.entries.filter(e => e.principalType === 'user'));

// The picker only needs ids for its empty-state logic; rows render via slot.
const groupItems = computed<PillItem[]>(() =>
  grantedGroups.value.map(e => ({ id: e.principalId, label: e.name })));
const userItems = computed<PillItem[]>(() =>
  grantedUsers.value.map(e => ({ id: e.principalId, label: e.name })));

const availableGroups = computed<PillItem[]>(() => {
  const granted = new Set(groupItems.value.map(item => item.id));
  return groupStore.groups
    .filter(g => !granted.has(g.id))
    .map(g => ({ id: g.id, label: g.name }));
});

/**
 * Owners bypass grants for ACCESS, but grants also drive notification
 * eligibility (bells, recipients) — so the owner is assignable like
 * anyone else.
 */
const availableUsers = computed<PillItem[]>(() => {
  const granted = new Set(userItems.value.map(item => item.id));
  return orgUserStore.users
    .filter(u => u.isActive && !granted.has(u.userId))
    .map(u => ({ id: u.userId, label: u.displayName }));
});

async function grant(type: AccessPrincipalType, principalId: string, permissions: number) {
  const result = await accessStore.grant(props.resourceType, props.resourceId, {
    principalType: type,
    principalId,
    permissions,
  });
  if (!result.ok && result.message) notifications.show(result.message, 'error');
}

async function revoke(type: AccessPrincipalType, principalId: string) {
  const result = await accessStore.revoke(props.resourceType, props.resourceId, type, principalId);
  if (!result.ok && result.message) notifications.show(result.message, 'error');
}

onMounted(() => {
  accessStore.ensureContext(props.resourceType, props.resourceId);
  void accessStore.fetchAccess(props.resourceType, props.resourceId);
  // Pickers; requires users.read — silently empty without it.
  void orgUserStore.fetchUsers({ silent: true });
  void groupStore.fetchGroups({ silent: true });
});
</script>

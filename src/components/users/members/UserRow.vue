<template>
    <div
      class="border-b border-text-secondary/25"
      :class="!user.isActive ? 'opacity-60' : ''"
    >
      <div
        class="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors max-md:flex-wrap"
        :class="canExpand ? 'cursor-pointer hover:bg-background-secondary/50' : ''"
        @click="canExpand && emit('toggle')"
      >
        <span class="text-sm font-medium text-text-primary shrink-0">{{ user.displayName }}</span>
        <span class="min-w-0 text-xs text-text-secondary truncate">{{ user.email }}</span>

        <!-- Pills: owner first, then groups, then state -->
        <BadgePill
          v-if="user.isOwner"
          class="shrink-0"
          color-class="bg-accent-primary/10 text-accent-primary"
          :label="t('users.owner')"
        />
        <BadgePill
          v-for="name in memberGroupNames"
          :key="name"
          class="shrink-0"
          :label="name"
        />
        <BadgePill
          v-if="!user.isActive"
          class="shrink-0"
          color-class="bg-status-warning/15 text-status-warning"
          :label="t('users.disabledBadge')"
        />

        <!-- Row actions: icons when collapsed, full buttons when expanded -->
        <div
          class="ml-auto flex items-center gap-1.5 shrink-0"
          @click.stop
        >
          <template v-if="canManage && !expanded">
            <IconButton
              :fa-icon="user.isActive ? faUserSlash : faUserCheck"
              :title="user.isActive ? t('users.disable') : t('users.enable')"
              @click="toggleActive"
            />
            <IconButton
              :fa-icon="faTrash"
              :title="t('users.deleteUser')"
              color-class="text-text-secondary hover:text-status-failure"
              @click="emit('toggle')"
            />
          </template>
          <template v-else-if="canManage && expanded">
            <SecondaryButton
              :label-text="user.isActive ? t('users.disable') : t('users.enable')"
              :fa-icon="user.isActive ? faUserSlash : faUserCheck"
              :on-click="toggleActive"
            />
            <DangerButton
              :label-text="t('users.deleteUser')"
              :hold-offset-sec="3"
              @safe-click="handleRemove"
            />
          </template>
          <FontAwesomeIcon
            v-if="canExpand"
            :icon="faChevronRight"
            class="w-2.5 h-2.5 text-text-secondary transition-transform cursor-pointer"
            :class="expanded ? 'rotate-90' : ''"
            @click="emit('toggle')"
          />
        </div>
      </div>

      <template v-if="expanded">
        <UserDetail :user="user" />
      </template>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faChevronRight, faTrash, faUserCheck, faUserSlash } from '@fortawesome/free-solid-svg-icons';
import IconButton from '@/components/core/buttons/IconButton.vue';
import SecondaryButton from '@/components/core/buttons/SecondaryButton.vue';
import DangerButton from '@/components/core/buttons/DangerButton.vue';
import UserDetail from '@/components/users/members/UserDetail.vue';
import { useGroupStore } from '@/store/core/group';
import { useOrgUserStore } from '@/store/core/orgUser';
import { useNotificationStore } from '@/store/ui/notifications';
import type { OrgUserSummary } from '@/data/orgs/PermissionDto';
import BadgePill from '@/components/core/BadgePill.vue';

/** One member row; expands into the permission/group editor with row actions. */
const props = defineProps<{
  user: OrgUserSummary;
  expanded: boolean;
  canEdit: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();

const { t } = useI18n();
const groupStore = useGroupStore();
const orgUserStore = useOrgUserStore();
const notifications = useNotificationStore();


/** Owners bypass the permission system — nothing to edit. */
const canExpand = computed(() => props.canEdit && !props.user.isOwner);
const canManage = computed(() => props.canEdit && !props.user.isOwner);

const memberGroupNames = computed(() =>
  props.user.groupIds
    .map(id => groupStore.groups.find(g => g.id === id)?.name)
    .filter((name): name is string => name != null));

async function toggleActive() {
  const result = await orgUserStore.toggleUserActive(props.user.userId, !props.user.isActive);
  if (!result.ok) {
    if (result.message) notifications.show(result.message, 'error');
    return;
  }
  notifications.show(t('users.statusUpdated'), 'success');
}

async function handleRemove() {
  const result = await orgUserStore.removeUser(props.user.userId);
  if (!result.ok) {
    if (result.message) notifications.show(result.message, 'error');
    return;
  }
  notifications.show(t('users.removed'), 'success');
}
</script>

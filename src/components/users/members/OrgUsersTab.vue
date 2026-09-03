<template>
    <div class="px-gutter py-6">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-semibold text-text-primary">
            {{ t('users.members') }}
          </h2>
          <SlotOutlet
            name="resource-meta"
            :slot-props="{ resource: 'users' }"
          />
        </div>
        <CreateToggleButton
          v-if="canEdit"
          v-model="inviteOpen"
          :label-text="t('users.invite')"
          :disabled="!isFeatureEnabled('invite.create')"
          :hint="t('common.actionUnavailable')"
        />
      </div>

      <div
        v-if="inviteOpen"
        class="mb-6 p-3 border-b border-text-secondary/50"
      >
        <h3 class="text-sm font-medium text-text-primary mb-3">
          {{ t('users.inviteTitle') }}
        </h3>
        <form
          class="flex items-center gap-2 max-w-2xl max-md:flex-col max-md:items-stretch"
          @submit.prevent="handleInvite(inviteEmail)"
        >
          <TextInput
            v-model="inviteEmail"
            compact
            class="flex-1"
            type="email"
            autocomplete="off"
            :placeholder="t('users.emailPlaceholder')"
          />
          <AppSelect
            v-model="inviteGroupIds"
            class="w-56 shrink-0"
            multiple
            searchable
            :placeholder="t('users.inviteGroups')"
            :options="groupOptions"
          />
          <PrimaryButton
            type="submit"
            class="shrink-0"
            :label-text="t('users.invite')"
            :disabled="!inviteEmail.trim() || !isFeatureEnabled('invite.create')"
          />
        </form>
      </div>

      <!-- Pending invites -->
      <div
        v-if="orgUserStore.invites.length > 0"
        class="mb-6"
      >
        <SectionHeading class="mb-2" :label="t('users.pendingInvites')" />
        <div
          v-for="invite in orgUserStore.invites"
          :key="invite.id"
          class="border-b border-text-secondary/25"
        >
          <div
            class="flex items-center gap-3 px-4 py-2 text-sm max-md:flex-wrap"
            :class="canEdit ? 'cursor-pointer hover:bg-background-secondary/50' : ''"
            @click="canEdit && (expandedInviteId = expandedInviteId === invite.id ? null : invite.id)"
          >
            <span class="text-text-primary max-md:w-full max-md:break-all">{{ invite.email }}</span>
            <BadgePill
              v-for="name in inviteGroupNames(invite)"
              :key="name"
              class="shrink-0"
              :label="name"
            />
            <span class="text-xs text-text-secondary ml-auto">
              {{ t('users.expires') }}: {{ formatDate(invite.expiresAt) }}
            </span>
            <IconButton
              v-if="canEdit"
              :fa-icon="faRotate"
              :title="t('users.resend')"
              @click.stop="handleResend(invite.email)"
            />
            <IconButton
              v-if="canEdit"
              :fa-icon="faTrash"
              :title="t('users.revoke')"
              color-class="text-text-secondary hover:text-status-failure"
              :hold-offset-sec="3"
              @safe-click="handleRevoke(invite.id)"
            />
          </div>

          <UserDetail
            v-if="expandedInviteId === invite.id"
            :user="inviteAsMember(invite)"
          />
        </div>
      </div>

      <LoadingState v-if="orgUserStore.usersLoading" />

      <EmptyState
        v-else-if="orgUserStore.users.length === 0"
        :icon="faUsers"
        :message="t('users.noUsers')"
      />

      <div v-else>
        <UserRow
          v-for="user in orgUserStore.users"
          :key="user.userId"
          :user="user"
          :expanded="expandedUserId === user.userId"
          :can-edit="canEdit"
          @toggle="toggleExpanded(user.userId)"
        />
      </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { isFeatureEnabled } from '@/config/extensions';
import type { SelectOption } from '@/types/ui/common';
import type { PendingInvite } from '@/data/orgs/InviteDto';
import { faRotate, faTrash, faUsers } from '@fortawesome/free-solid-svg-icons';
import CreateToggleButton from '@/components/core/buttons/CreateToggleButton.vue';
import SlotOutlet from '@/components/core/SlotOutlet.vue';
import IconButton from '@/components/core/buttons/IconButton.vue';
import EmptyState from '@/components/core/EmptyState.vue';
import AppSelect from '@/components/core/input/AppSelect.vue';
import BadgePill from '@/components/core/BadgePill.vue';
import UserDetail from '@/components/users/members/UserDetail.vue';
import type { DetailMember } from '@/types/ui/members';
import TextInput from '@/components/core/input/TextInput.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import UserRow from '@/components/users/members/UserRow.vue';
import { useAuthStore } from '@/store/core/auth';
import { useOrgUserStore } from '@/store/core/orgUser';
import { useGroupStore } from '@/store/core/group';
import { useNotificationStore } from '@/store/ui/notifications';
import LoadingState from '@/components/core/LoadingState.vue';
import SectionHeading from '@/components/core/SectionHeading.vue';

/** Members tab: pending invites, member list, per-user permission editing. */
const { t } = useI18n();
const authStore = useAuthStore();
const orgUserStore = useOrgUserStore();
const groupStore = useGroupStore();
const notifications = useNotificationStore();

const inviteOpen = ref<boolean>(false);
const inviteEmail = ref<string>('');
const inviteGroupIds = ref<string[]>([]);

const groupOptions = computed<SelectOption[]>(() =>
  groupStore.groups.map(g => ({ value: g.id, label: g.name })));
const expandedUserId = ref<string | null>(null);
const expandedInviteId = ref<string | null>(null);

const canEdit = computed(() => authStore.canWrite('users'));

function toggleExpanded(userId: string) {
  expandedUserId.value = expandedUserId.value === userId ? null : userId;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return isNaN(date.getTime()) ? iso : date.toLocaleDateString();
}

async function handleInvite(email: string) {
  const result = await orgUserStore.inviteUser(email, inviteGroupIds.value.length > 0 ? inviteGroupIds.value : undefined);
  if (!result.ok) {
    if (result.message) notifications.show(result.message, 'error');
    return;
  }
  inviteOpen.value = false;
  inviteEmail.value = '';
  inviteGroupIds.value = [];
  notifications.show(t('users.invited'), 'success');
}

/** Adapts a pending invite to the shared member-detail panel. */
function inviteAsMember(invite: PendingInvite): DetailMember {
  return {
    userId: invite.userId,
    groupIds: invite.groupIds ?? [],
    org: invite.org ?? { users: 0, settings: 0, domains: 0, webhooks: 0, notifications: 0, admin: 0, workspaces: 0 },
  };
}

function inviteGroupNames(invite: PendingInvite): string[] {
  return (invite.groupIds ?? [])
    .map(id => groupStore.groups.find(g => g.id === id)?.name)
    .filter((name): name is string => name != null);
}

/** Resend goes through the same endpoint as invite (cooldown-guarded server-side). */
async function handleResend(email: string) {
  const result = await orgUserStore.inviteUser(email);
  if (!result.ok) {
    if (result.message) notifications.show(result.message, 'error');
    return;
  }
  notifications.show(t('users.inviteResent'), 'success');
}

async function handleRevoke(inviteId: string) {
  const result = await orgUserStore.revokeInvite(inviteId);
  if (!result.ok) {
    if (result.message) notifications.show(result.message, 'error');
    return;
  }
  notifications.show(t('users.inviteRevoked'), 'success');
}

onMounted(() => {
  void orgUserStore.fetchUsers();
  void orgUserStore.fetchInvites();
  // Group names for the row chips and the membership picker.
  void groupStore.fetchGroups();
});
</script>

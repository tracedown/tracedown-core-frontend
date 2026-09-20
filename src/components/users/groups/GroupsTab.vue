<template>
    <div class="px-gutter py-6">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-semibold text-text-primary">
            {{ t('groups.title') }}
          </h2>
          <SlotOutlet
            name="resource-meta"
            :slot-props="{ resource: 'groups' }"
          />
        </div>
        <CreateToggleButton
          v-if="canEdit"
          v-model="createOpen"
          :label-text="t('groups.createNew')"
          :disabled="!createGate.enabled"
          :hint="createGate.hint"
        />
      </div>

      <InlineCreateForm
        v-if="createOpen"
        :title="t('groups.createTitle')"
        :placeholder="t('groups.namePlaceholder')"
        @create="handleCreate"
      />

      <LoadingState v-if="groupStore.loading" />

      <EmptyState
        v-else-if="groupStore.groups.length === 0"
        :icon="faUserGroup"
        :message="t('groups.noGroups')"
        :description="t('groups.noGroupsDescription')"
      />

      <div v-else>
        <div
          v-for="group in groupStore.groups"
          :key="group.id"
          class="border-b border-text-secondary/25"
        >
          <button
            class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-background-secondary/50 transition-colors"
            @click="toggleExpanded(group.id)"
          >
            <span class="text-sm font-medium text-text-primary">{{ group.name }}</span>
            <BadgePill
              color-class="bg-text-secondary/10 text-text-secondary"
              :label="t('groups.memberCount', { n: group.memberCount })"
            />
            <FontAwesomeIcon
              :icon="faChevronRight"
              class="w-2.5 h-2.5 text-text-secondary ml-auto transition-transform shrink-0"
              :class="expandedGroupId === group.id ? 'rotate-90' : ''"
            />
          </button>

          <GroupDetail
            v-if="expandedGroupId === group.id"
            :group="group"
            :can-edit="canEdit"
            @deleted="expandedGroupId = null"
          />
        </div>
      </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faChevronRight, faUserGroup } from '@fortawesome/free-solid-svg-icons';
import CreateToggleButton from '@/components/core/buttons/CreateToggleButton.vue';
import SlotOutlet from '@/components/core/SlotOutlet.vue';
import EmptyState from '@/components/core/EmptyState.vue';
import InlineCreateForm from '@/components/resource/InlineCreateForm.vue';
import GroupDetail from '@/components/users/groups/GroupDetail.vue';
import { useAuthStore } from '@/store/core/auth';
import { useGroupStore } from '@/store/core/group';
import { useNotificationStore } from '@/store/ui/notifications';
import { useFeatureGate } from '@/composables/useFeatureGate';
import LoadingState from '@/components/core/LoadingState.vue';
import BadgePill from '@/components/core/BadgePill.vue';

/** Groups tab: list, creation, and per-group detail (permissions + members). */
const { t } = useI18n();
const authStore = useAuthStore();
const groupStore = useGroupStore();
const notifications = useNotificationStore();
const createGate = useFeatureGate('group.create');

const createOpen = ref<boolean>(false);
const expandedGroupId = ref<string | null>(null);

const canEdit = computed(() => authStore.canWrite('users'));

function toggleExpanded(groupId: string) {
  expandedGroupId.value = expandedGroupId.value === groupId ? null : groupId;
}

async function handleCreate(name: string) {
  const result = await groupStore.createGroup(name);
  if (!result.ok || !result.data) {
    if (result.message) notifications.show(result.message, 'error');
    return;
  }
  createOpen.value = false;
  notifications.show(t('groups.created'), 'success');
  expandedGroupId.value = result.data.id;
}

onMounted(() => {
  void groupStore.fetchGroups();
});
</script>

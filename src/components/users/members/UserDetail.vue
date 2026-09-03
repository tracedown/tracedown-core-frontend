<template>
    <div class="px-4 pb-4 grid grid-cols-2 gap-8 mt-2 max-md:grid-cols-1 max-md:gap-6">
      <!-- Left: global section permissions -->
      <div>
        <SectionHeading class="mb-2" :label="t('permissions.title')" />
        <PermissionMatrix
          v-model="draft"
          :floors="groupFloors"
        />
        <div class="mt-3 flex justify-end">
          <PrimaryButton
            :label-text="t('common.actions.save')"
            :loading="saving"
            :disabled="!isDirty"
            :on-click="saveSections"
          />
        </div>
      </div>

      <!-- Right: group membership -->
      <GroupMembershipPicker :user="user" />
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import PermissionMatrix from '@/components/users/PermissionMatrix.vue';
import GroupMembershipPicker from '@/components/users/members/GroupMembershipPicker.vue';
import { useGroupStore } from '@/store/core/group';
import { useOrgUserStore } from '@/store/core/orgUser';
import { useNotificationStore } from '@/store/ui/notifications';
import type { OrgSectionPermissions } from '@/data/orgs/PermissionDto';
import type { DetailMember } from '@/types/ui/members';
import type { AccessSection, BuiltinAccessSection, SectionFloor } from '@/types/access';
import SectionHeading from '@/components/core/SectionHeading.vue';

/**
 * Expanded member panel: global section levels on the left, group membership
 * on the right. Works for active members and pending invites alike (the
 * backend allows pre-configuring both permissions and groups before
 * acceptance). Rendered only for users.write holders (non-owners).
 */
const props = defineProps<{
  user: DetailMember;
}>();

const { t } = useI18n();
const groupStore = useGroupStore();
const orgUserStore = useOrgUserStore();
const notifications = useNotificationStore();

const saving = ref<boolean>(false);

const draft = ref<OrgSectionPermissions>({ ...props.user.org });

const SECTION_KEYS: BuiltinAccessSection[] = ['users', 'settings', 'domains', 'webhooks', 'notifications', 'admin', 'workspaces'];

/** Highest level each of the member's groups grants per section (+ which group). */
const groupFloors = computed<Partial<Record<AccessSection, SectionFloor>>>(() => {
  const floors: Partial<Record<AccessSection, SectionFloor>> = {};
  for (const group of groupStore.groups) {
    if (!props.user.groupIds.includes(group.id)) continue;
    for (const section of SECTION_KEYS) {
      const level = group[section];
      if (level > 0 && level > (floors[section]?.level ?? 0)) {
        floors[section] = { level, source: group.name };
      }
    }
  }
  return floors;
});

const isDirty = computed(() =>
  (Object.keys(draft.value) as (keyof OrgSectionPermissions)[])
    .some(key => draft.value[key] !== props.user.org[key]));

// Keyed on the member id, not the object: live org events replace the array
// (new object identities) and must not wipe an unsaved same-entity draft.
watch(() => props.user.userId, () => {
  draft.value = { ...props.user.org };
});

async function saveSections() {
  saving.value = true;
  try {
    const result = await orgUserStore.updateUserPermissions(props.user.userId, { ...draft.value });
    if (!result.ok) {
      if (result.message) notifications.show(result.message, 'error');
      return;
    }
    notifications.show(t('users.permissionsUpdated'), 'success');
  } finally {
    saving.value = false;
  }
}
</script>

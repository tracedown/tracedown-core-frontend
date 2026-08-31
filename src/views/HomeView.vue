<template>
    <div class="flex flex-col items-center justify-center py-24 px-6">
      <FontAwesomeIcon :icon="faBoxOpen" class="w-12 h-12 text-text-secondary mb-4" />

      <!-- Signed in but not a member of any organization. -->
      <template v-if="!orgStore.hasOrgs">
        <h1 class="text-xl font-semibold text-text-primary mb-2">
          {{ t('workspace.noOrganizations') }}
        </h1>
        <p class="text-sm text-text-secondary mb-6 text-center max-w-sm">
          {{ t('workspace.noOrganizationsDescription') }}
        </p>
        <!-- A host may know a way out of this state that the built-in app does
             not: how an account without any organization gets one here. Nothing
             is rendered when no host fills it, so the un-extended behaviour is
             unchanged. -->
        <SlotOutlet name="no-organizations" />
      </template>

      <!-- In an org, but it has no (accessible) workspaces yet. -->
      <template v-else>
        <h1 class="text-xl font-semibold text-text-primary mb-2">
          {{ t('workspace.noWorkspaces') }}
        </h1>
        <p class="text-sm text-text-secondary mb-6">
          {{ t('workspace.noWorkspacesDescription') }}
        </p>

        <div v-if="authStore.canWrite('workspaces')">
          <span
            v-if="!showCreateForm"
            class="inline-block"
            :title="isFeatureEnabled('workspace.create') ? undefined : t('common.actionUnavailable')"
          >
            <PrimaryButton
              :label-text="t('workspace.createNew')"
              :fa-icon="faPlus"
              :disabled="!isFeatureEnabled('workspace.create')"
              :on-click="() => showCreateForm = true"
            />
          </span>
          <InputActionRow
            v-else
            v-model="newName"
            :placeholder="t('workspace.namePlaceholder')"
            :action-label="t('common.actions.create')"
            @submit="handleCreate"
          >
            <GhostButton
              :label-text="t('common.actions.cancel')"
              :on-click="cancelCreate"
            />
          </InputActionRow>
        </div>
      </template>
    </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { isFeatureEnabled } from '@/config/extensions';
import { useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faBoxOpen, faPlus } from '@fortawesome/free-solid-svg-icons';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import GhostButton from '@/components/core/buttons/GhostButton.vue';
import { useAuthStore } from '@/store/core/auth';
import { useOrgStore } from '@/store/core/org';
import { useWorkspaceStore } from '@/store/core/workspace';
import { useNotificationStore } from '@/store/ui/notifications';
import InputActionRow from '@/components/core/input/InputActionRow.vue';
import SlotOutlet from '@/components/core/SlotOutlet.vue';

/**
 * Landing view of `/` for sessions without any workspace — the router guard
 * forwards to the selected workspace whenever one exists.
 */
const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const orgStore = useOrgStore();
const workspaceStore = useWorkspaceStore();
const notifications = useNotificationStore();

const showCreateForm = ref<boolean>(false);
const newName = ref<string>('');

// Redirect once workspaces become available (e.g. created in another tab).
watch(() => workspaceStore.hasWorkspaces, (has) => {
  if (has) {
    const id = workspaceStore.selectedWorkspaceId ?? workspaceStore.workspaces[0].id;
    workspaceStore.setSelectedWorkspace(id);
    void router.replace({ name: 'workspace', params: { workspaceId: id } });
  }
});

function cancelCreate() {
  showCreateForm.value = false;
  newName.value = '';
}

async function handleCreate() {
  const name = newName.value.trim();
  if (!name) return;
  const result = await workspaceStore.createWorkspace({ name });
  if (!result.ok || !result.data) {
    if (result.message) notifications.show(result.message, 'error');
    return;
  }
  workspaceStore.setSelectedWorkspace(result.data.id);
  void router.push({ name: 'workspace', params: { workspaceId: result.data.id } });
}
</script>
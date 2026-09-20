<template>
    <DropdownPanel
      v-if="workspaceStore.hasWorkspaces"
      panel-class="w-64"
    >
      <template #trigger="{ open, toggle }">
        <button
          class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-text-secondary
               hover:bg-background-primary transition-colors"
          @click="toggle"
        >
          <FontAwesomeIcon :icon="faLayerGroup" class="w-3.5 h-3.5" />
          <span class="text-text-primary font-medium">
            {{ workspaceStore.currentWorkspace?.name ?? t('workspace.select') }}
          </span>
          <FontAwesomeIcon
            :icon="open ? faChevronDown : faChevronRight"
            class="w-2.5 h-2.5"
          />
        </button>
      </template>

      <!--   Header   -->
      <template #default="{ close }">
        <div
          class="flex items-center justify-between
            px-3 h-10
            border-b border-b-accent-secondary"
        >
          <template v-if="!createMode">
            <div class="flex items-center gap-2">
              <div class="text-text-primary">
                {{ t('common.entities.workspaces') }}
              </div>
              <SlotOutlet
                name="resource-meta"
                :slot-props="{ resource: 'workspaces' }"
              />
            </div>

            <!--  The title rides the wrapper, not the button: a disabled
                  button is inert and a native tooltip on it never opens.  -->
            <div
              v-if="authStore.canWrite('workspaces')"
              class="w-5"
              :title="createGate.hint || undefined"
            >
              <PrimaryButton
                label-text=""
                class="scale-75"
                full-width
                :fa-icon="faPlus"
                :disabled="!createGate.enabled"
                @click="createMode = true"
              />
            </div>
          </template>

          <div v-else class="flex items-center gap-0.5">
            <TextInput
              v-model="newName"
              class="h-7"
              :placeholder="t('workspace.namePlaceholder')"
            />

            <div class="w-6">
              <PrimaryButton
                label-text=""
                class="scale-75"
                full-width
                :fa-icon="faCheck"
                :disabled="!canSubmit"
                @click="createWorkspace(close)"
              />
            </div>

            <div class="w-6">
              <SecondaryButton
                label-text=""
                class="scale-75"
                full-width
                :fa-icon="faXmark"
                @click="cancelCreateMode()"
              />
            </div>
          </div>
        </div>

        <!--    List    -->
        <button
          v-for="ws in workspaceStore.workspaces"
          :key="ws.id"
          class="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-background-primary/50"
          :class="ws.id === workspaceStore.selectedWorkspaceId ? 'text-accent-primary font-medium' : 'text-text-primary'"
          @click="selectWorkspace(ws.id, close)"
        >
          {{ ws.name }}
        </button>
      </template>
    </DropdownPanel>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faCheck,
  faChevronDown,
  faChevronRight,
  faLayerGroup,
  faPlus, faXmark
} from '@fortawesome/free-solid-svg-icons';
import DropdownPanel from '@/components/core/DropdownPanel.vue';
import SlotOutlet from '@/components/core/SlotOutlet.vue';
import { useAuthStore } from '@/store/core/auth';
import { useWorkspaceStore } from '@/store/core/workspace';
import { useNotificationStore } from '@/store/ui/notifications';
import { useFeatureGate } from '@/composables/useFeatureGate';
import PrimaryButton from "@/components/core/buttons/PrimaryButton.vue";
import TextInput from "@/components/core/input/TextInput.vue";
import SecondaryButton from "@/components/core/buttons/SecondaryButton.vue";

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const workspaceStore = useWorkspaceStore();
const notifications = useNotificationStore();
const createGate = useFeatureGate('workspace.create');

const createMode = ref<boolean>(false);
const newName = ref<string>('');

const canSubmit = computed(() => newName.value.trim() != '');

function cancelCreateMode(): void {
  createMode.value = false;
  newName.value = '';
}

function selectWorkspace(id: string, close: () => void) {
  close();
  if (id === workspaceStore.selectedWorkspaceId) return;
  workspaceStore.setSelectedWorkspace(id);
  void router.push({ name: 'workspace', params: { workspaceId: id } });
}

async function createWorkspace(close: () => void) {
  const name = newName.value.trim();
  if (!name) return;
  const result = await workspaceStore.createWorkspace({ name });
  if (!result.ok || !result.data) {
    if (result.message) notifications.show(result.message, 'error');
    return;
  }
  newName.value = '';
  createMode.value = false;
  close();
  workspaceStore.setSelectedWorkspace(result.data.id);
  void router.push({ name: 'workspace', params: { workspaceId: result.data.id } });
}
</script>

<template>
    <ModalDialog
      :modal-name="t('presets.title')"
      wide
      @close="emit('close')"
    >
      <LoadingState v-if="presetStore.loading" />
      <EmptyState
        v-else-if="presetStore.presets.length === 0"
        compact
        :message="t('presets.empty')"
      />
      <div
        v-else
        class="flex gap-4 max-md:flex-col"
      >
        <!-- Preset list -->
        <div class="w-72 shrink-0 space-y-1 overflow-y-auto max-h-[55vh] max-md:w-full max-md:max-h-56">
          <button
            v-for="preset in presetStore.presets"
            :key="preset.id"
            type="button"
            class="w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded transition-colors"
            :class="selected?.id === preset.id
              ? 'bg-accent-primary/10 text-accent-primary'
              : 'text-text-primary hover:bg-background-primary'"
            @click="selected = preset"
          >
            <span class="truncate flex-1">{{ preset.name }}</span>
            <BadgePill
              class="shrink-0"
              :color-class="preset.scope === 'workspace'
                ? 'bg-accent-primary/10 text-accent-primary'
                : 'bg-text-secondary/10 text-text-secondary'"
              :label="t(`presets.scopes.${preset.scope}`)"
            />
            <IconButton
              v-if="canDelete(preset)"
              :fa-icon="faTrash"
              :title="t('common.actions.delete')"
              color-class="text-text-secondary hover:text-status-failure"
              icon-class="w-3 h-3"
              :hold-offset-sec="3"
              @safe-click="handleDelete(preset)"
            />
          </button>
        </div>

        <!-- Script preview -->
        <div class="flex-1 min-w-0">
          <LaceEditor
            v-if="selected"
            :model-value="selected.script"
            readonly
            min-height="20rem"
            max-height="55vh"
          />
          <p
            v-else
            class="text-sm text-text-secondary italic py-8 text-center"
          >
            {{ t('presets.selectHint') }}
          </p>
        </div>
      </div>

      <!-- Save the current editor script as a new template. -->
      <div class="mt-4 border-t border-text-secondary/25 pt-3">
        <p class="text-xs text-text-secondary mb-1">
          {{ t('presets.saveCurrentHint') }}
        </p>
        <InputActionRow
          v-model="presetName"
          compact
          class="max-w-md"
          :placeholder="t('presets.namePlaceholder')"
          :action-label="t('presets.saveAs')"
          @submit="handleSavePreset"
        />
      </div>

      <!--  Actions in the dialog's footer: on a phone the sheet pins this
            above the fold instead of leaving Apply below a long preset list.  -->
      <template #footer>
        <div class="flex items-center gap-2 max-md:flex-wrap">
          <PrimaryButton
            :label-text="t('presets.apply')"
            :disabled="!selected"
            :on-click="apply"
          />
          <GhostButton
            :label-text="t('common.actions.cancel')"
            :on-click="() => emit('close')"
          />
          <span class="text-xs text-text-secondary ml-auto max-md:ml-0 max-md:w-full">
            {{ t('presets.replaceHint') }}
          </span>
        </div>
      </template>
    </ModalDialog>
</template>

<script setup lang="ts">
import { defineAsyncComponent, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import ModalDialog from '@/components/core/ModalDialog.vue';
import LoadingState from '@/components/core/LoadingState.vue';
import LoadingSpinner from '@/components/core/LoadingSpinner.vue';
import EmptyState from '@/components/core/EmptyState.vue';
import BadgePill from '@/components/core/BadgePill.vue';
import IconButton from '@/components/core/buttons/IconButton.vue';
import InputActionRow from '@/components/core/input/InputActionRow.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import GhostButton from '@/components/core/buttons/GhostButton.vue';
import { useAuthStore } from '@/store/core/auth';
import { useRulePresetStore } from '@/store/core/rulePreset';
import { useNotificationStore } from '@/store/ui/notifications';
import type { RulePresetSummary } from '@/data/presets/RulePresetDto';

/**
 * Preset Library picker: list on the left, read-only script preview on the
 * right, Apply replaces the editor's script. Presets are deletable given
 * write access to their scope (org-wide → org workspaces write;
 * workspace-scoped → write on that workspace).
 */
const props = defineProps<{
  /** Scopes the list so workspace presets from elsewhere don't show. */
  workspaceId?: string;
  /** The editor's current script — offered for "save as template". */
  currentScript: string;
}>();

const emit = defineEmits<{
  apply: [script: string];
  close: [];
}>();

// Shares CodeMirror with the editor chunk — load on demand.
const LaceEditor = defineAsyncComponent({
  loader: () => import('@/components/core/editor/LaceEditor.vue'),
  loadingComponent: LoadingSpinner,
});

const { t } = useI18n();
const authStore = useAuthStore();
const presetStore = useRulePresetStore();
const notifications = useNotificationStore();

const selected = ref<RulePresetSummary | null>(null);
const presetName = ref<string>('');

/** Saves the editor's current script as a new preset, then refreshes the list. */
async function handleSavePreset(name: string) {
  if (!props.currentScript.trim()) {
    notifications.show(t('presets.emptyScript'), 'error');
    return;
  }
  const result = await presetStore.createPreset({ name, script: props.currentScript });
  if (!result.ok) {
    if (result.message) notifications.show(result.message, 'error');
    return;
  }
  presetName.value = '';
  notifications.show(t('presets.saved'), 'success');
  void presetStore.fetchPresets(props.workspaceId);
}

/** Mirrors the API's gating: write access to the preset's scope. */
function canDelete(preset: RulePresetSummary): boolean {
  if (preset.scope === 'org') return authStore.canWrite('workspaces');
  return props.workspaceId != null
    && authStore.canWriteScoped([`workspace::${props.workspaceId}`]);
}

function apply() {
  if (selected.value) emit('apply', selected.value.script);
}

async function handleDelete(preset: RulePresetSummary) {
  const result = await presetStore.deletePreset(preset.id);
  if (!result.ok) {
    if (result.message) notifications.show(result.message, 'error');
    return;
  }
  if (selected.value?.id === preset.id) selected.value = null;
}

onMounted(() => {
  void presetStore.fetchPresets(props.workspaceId);
});
</script>

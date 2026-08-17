<template>
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-text-secondary mb-1">{{ t('common.labels.name') }}</label>
          <TextInput v-model="name" />
        </div>
        <div>
          <label class="block text-xs font-medium text-text-secondary mb-1">{{ t('service.labelField') }}</label>
          <TextInput
            v-model="label"
            :placeholder="t('service.labelPlaceholder')"
          />
        </div>
      </div>
      <div>
        <label class="block text-xs font-medium text-text-secondary mb-1">{{ t('service.schedule') }}</label>
        <TextInput
          v-model="schedule"
          class="font-mono"
        />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div v-if="isFeatureEnabled('agents')">
          <div class="flex items-center gap-1 mb-1">
            <label class="text-xs font-medium text-text-secondary">{{ t('service.probeMode') }}</label>
            <HelpTooltip :entries="probeModeHelp" />
          </div>
          <AppSelect
            v-model="probeMode"
            :options="probeModeOptions"
          />
        </div>
        <div>
          <div class="flex items-center gap-1 mb-1">
            <label class="text-xs font-medium text-text-secondary">{{ t('service.queuePolicy') }}</label>
            <HelpTooltip :entries="queuePolicyHelp" />
          </div>
          <AppSelect
            v-model="queuePolicy"
            :options="queuePolicyOptions"
          />
        </div>
      </div>

      <ServiceWindowEditor
        v-model="serviceWindowRule"
        v-model:valid="windowValid"
      />

      <div class="group relative">
        <LaceEditor
          v-model="script"
          min-height="12rem"
          :service-name="name"
          :collab-id="service.id"
          @validate="onValidation"
        />
        <!-- Floating editor actions — dimmed at rest, full opacity on hover. -->
        <div
          class="absolute top-2 right-2 z-10 flex flex-col gap-1 rounded
                 bg-background-secondary/70 backdrop-blur-sm p-1
                 opacity-50 transition-opacity group-hover:opacity-100"
        >
          <IconButton
            :fa-icon="faFileImport"
            :title="t('presets.load')"
            color-class="text-text-secondary hover:text-accent-primary"
            icon-class="w-4 h-4"
            @click="templateModalOpen = true"
          />
          <IconButton
            :fa-icon="faDownload"
            :title="t('editor.saveToFile')"
            color-class="text-text-secondary hover:text-accent-primary"
            icon-class="w-4 h-4"
            @click="saveToFile"
          />
          <IconButton
            :fa-icon="faUpload"
            :title="t('editor.loadFromFile')"
            color-class="text-text-secondary hover:text-accent-primary"
            icon-class="w-4 h-4"
            @click="triggerLoadFile"
          />
        </div>
        <input
          ref="fileInput"
          type="file"
          accept=".lace,text/plain"
          class="hidden"
          @change="onFileSelected"
        >
      </div>

      <ServiceTemplateModal
        v-if="templateModalOpen"
        :workspace-id="workspaceId"
        :current-script="script"
        @apply="applyTemplate"
        @close="templateModalOpen = false"
      />

      <div
        v-if="isFeatureEnabled('agents')"
        class="border-t border-text-secondary/25 pt-4 mt-2"
      >
        <ServiceAgentsPicker :service-id="service.id" />
      </div>

      <div class="border-t border-text-secondary/25 pt-4 mt-2">
        <WebhookBindings
          resource-type="service"
          :resource-id="service.id"
        />
      </div>

      <div class="flex items-center gap-2">
        <PrimaryButton
          :label-text="t('common.actions.save')"
          :disabled="saving || !script.trim() || hasValidationErrors || !windowValid"
          :on-click="save"
        />
        <GhostButton
          :label-text="t('common.actions.cancel')"
          :on-click="() => emit('cancel')"
        />
        <span
          v-if="hasValidationErrors"
          class="text-xs text-status-failure"
        >
          {{ t('service.hasErrors') }}
        </span>
        <DangerButton
          class="ml-auto"
          :label-text="t('service.deleteButton')"
          :hold-offset-sec="3"
          @safe-click="emit('delete')"
        />
      </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { faDownload, faFileImport, faUpload } from '@fortawesome/free-solid-svg-icons';
import TextInput from '@/components/core/input/TextInput.vue';
import AppSelect from '@/components/core/input/AppSelect.vue';
import HelpTooltip from '@/components/core/HelpTooltip.vue';
import ServiceWindowEditor from '@/components/service/detail/ServiceWindowEditor.vue';
import ServiceTemplateModal from '@/components/service/detail/ServiceTemplateModal.vue';
import WebhookBindings from '@/components/webhooks/WebhookBindings.vue';
import ServiceAgentsPicker from '@/components/service/detail/ServiceAgentsPicker.vue';
import IconButton from '@/components/core/buttons/IconButton.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import GhostButton from '@/components/core/buttons/GhostButton.vue';
import DangerButton from '@/components/core/buttons/DangerButton.vue';
import { getScriptEditor, isFeatureEnabled } from '@/config/extensions';
import { saveLaceFile } from '@/lib/lace-codemirror';
import { useProjectStore } from '@/store/core/project';
import { useNotificationStore } from '@/store/ui/notifications';
import { useServiceHelp } from '@/composables/useServiceHelp';
import type { ServiceSummary, UpdateServiceConfigRequest } from '@/data/services/ServiceDto';
import type { ServiceEditPayload } from '@/types/services';
import type { SelectOption } from '@/types/ui/common';

const props = defineProps<{
  service: ServiceSummary;
  saving: boolean;
}>();

const emit = defineEmits<{
  save: [payload: ServiceEditPayload];
  cancel: [];
  delete: [];
}>();

// Resolved from the extension registry — the built-in Lace editor by default,
// or a host-provided replacement.
const LaceEditor = getScriptEditor();

const { t } = useI18n();
const projectStore = useProjectStore();
const notifications = useNotificationStore();

const name = ref<string>(props.service.name);
const label = ref<string>(props.service.label ?? '');
const schedule = ref<string>(props.service.schedule);
const probeMode = ref<string>(props.service.probeMode);
const queuePolicy = ref<string>(props.service.queuePolicy);
const script = ref<string>(props.service.script);

// Maintenance-window rule ('' = none); the editor owns the field logic.
const serviceWindowRule = ref<string>(props.service.serviceWindow ?? '');
const windowValid = ref<boolean>(true);

const hasValidationErrors = ref<boolean>(false);

// ── Preset Library (load templates; save-as lives in the modal) ──
const templateModalOpen = ref<boolean>(false);

/** The service's workspace scopes the preset list. */
const workspaceId = computed(() =>
  projectStore.projects.find(p => p.id === props.service.projectId)?.workspaceId);

function applyTemplate(templateScript: string) {
  script.value = templateScript;
  templateModalOpen.value = false;
}

// ── File actions (floating editor toolbar) ──
const fileInput = ref<HTMLInputElement | null>(null);

/** Downloads the current script as <snake_case_name>.lace. */
function saveToFile() {
  saveLaceFile(script.value, name.value);
}

function triggerLoadFile() {
  fileInput.value?.click();
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    script.value = await file.text();
  } catch {
    notifications.show(t('editor.loadFailed'), 'error');
  } finally {
    // Reset so selecting the same file again re-triggers change.
    input.value = '';
  }
}

const probeModeOptions = computed<SelectOption[]>(() => [
  { value: 'consecutive', label: t('service.probeModeConsecutive') },
  { value: 'simultaneous', label: t('service.probeModeSimultaneous') },
  { value: 'random', label: t('service.probeModeRandom') },
]);

const queuePolicyOptions = computed<SelectOption[]>(() => [
  { value: 'skip', label: t('service.queuePolicySkip') },
  { value: 'enqueue_once', label: t('service.queuePolicyEnqueue') },
]);

const { probeModeHelp, queuePolicyHelp } = useServiceHelp();

function onValidation(errorCount: number) {
  hasValidationErrors.value = errorCount > 0;
}

function save() {
  const config: UpdateServiceConfigRequest = {};
  if (name.value.trim() !== props.service.name) config.name = name.value.trim();
  if (label.value.trim() !== (props.service.label ?? '')) config.label = label.value.trim();
  if (schedule.value !== props.service.schedule) config.schedule = schedule.value;
  if (probeMode.value !== props.service.probeMode) config.probeMode = probeMode.value;
  if (queuePolicy.value !== props.service.queuePolicy) config.queuePolicy = queuePolicy.value;
  // Empty string clears the window server-side.
  if (serviceWindowRule.value !== (props.service.serviceWindow ?? '')) {
    config.serviceWindow = serviceWindowRule.value;
  }

  emit('save', {
    config,
    script: script.value !== props.service.script ? script.value : null,
  });
}
</script>

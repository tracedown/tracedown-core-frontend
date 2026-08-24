<template>
    <DropdownPanel
      align-right
      panel-class="w-56"
    >
      <template #trigger="{ toggle }">
        <IconButton
          :fa-icon="faEllipsisVertical"
          :title="t('service.scopedToggle.menu')"
          @click="toggle"
        />
      </template>

      <template #default="{ close }">
        <button
          v-for="option in OPTIONS"
          :key="option.key"
          class="flex items-center gap-2 w-full px-3 py-2 text-left text-sm
               text-text-primary hover:bg-background-primary/50 transition-colors"
          @click="ask(option.enable, close)"
        >
          <FontAwesomeIcon
            :icon="option.icon"
            class="w-3.5 h-3.5 text-text-secondary"
          />
          {{ t(option.labelKey) }}
        </button>
      </template>
    </DropdownPanel>

    <ModalDialog
      v-if="pending !== null"
      :modal-name="t(pending ? 'service.scopedToggle.enableTitle' : 'service.scopedToggle.disableTitle')"
      @close="dismiss"
    >
      <!-- Phase one: what is about to happen, in the words of the scope. -->
      <div
        v-if="!outcome"
        class="p-2 space-y-4"
      >
        <p class="text-sm text-text-secondary">
          {{ t(confirmKey) }}
        </p>
        <p
          v-if="!pending"
          class="text-sm text-text-secondary"
        >
          {{ t('service.scopedToggle.disableNote') }}
        </p>
        <div class="flex justify-end gap-2">
          <SecondaryButton
            :label-text="t('common.actions.cancel')"
            :on-click="dismiss"
          />
          <PrimaryButton
            :label-text="t(pending ? 'service.scopedToggle.enableConfirm' : 'service.scopedToggle.disableConfirm')"
            :loading="submitting"
            :on-click="submit"
          />
        </div>
      </div>

      <!-- Phase two, only when something was left behind. A count in a toast
           says six were skipped; this says which six, so they can be fixed. -->
      <div
        v-else
        class="p-2 space-y-4"
      >
        <p class="text-sm text-text-primary">
          {{ t('service.scopedToggle.changed', { changed: outcome.changed, matched: outcome.matched }) }}
        </p>
        <div>
          <p class="text-sm font-medium text-text-primary mb-2">
            {{ t('service.scopedToggle.skippedHeading', { count: outcome.skipped.length }) }}
          </p>
          <ul class="divide-y divide-text-secondary/20 border-y border-text-secondary/20">
            <li
              v-for="skipped in outcome.skipped"
              :key="skipped.serviceId"
              class="flex items-baseline justify-between gap-4 py-2 text-sm"
            >
              <span class="text-text-primary truncate">{{ skipped.name }}</span>
              <span class="text-text-secondary shrink-0">{{ reasonLabel(skipped.reason) }}</span>
            </li>
          </ul>
        </div>
        <div class="flex justify-end">
          <PrimaryButton
            :label-text="t('common.actions.close')"
            :on-click="dismiss"
          />
        </div>
      </div>
    </ModalDialog>
</template>

<script setup lang="ts">
/**
 * Enables or disables every service in a project or workspace.
 *
 * One request, not a loop: the backend moves the whole scope in a single
 * transaction, so there is no half-applied state for this component to show or
 * recover from. It either all moved, or nothing did and the message says why.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faEllipsisVertical, faPlay, faPause } from '@fortawesome/free-solid-svg-icons';
import DropdownPanel from '@/components/core/DropdownPanel.vue';
import ModalDialog from '@/components/core/ModalDialog.vue';
import IconButton from '@/components/core/buttons/IconButton.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import SecondaryButton from '@/components/core/buttons/SecondaryButton.vue';
import { useServiceStore } from '@/store/core/service';
import { useNotificationStore } from '@/store/ui/notifications';
import type { ScopedToggleResult } from '@/data/services/ServiceDto';

const props = defineProps<{
  scope: 'project' | 'workspace';
  scopeId: string;
}>();

const { t } = useI18n();
const serviceStore = useServiceStore();
const notifications = useNotificationStore();

const OPTIONS = [
  { key: 'enable', enable: true, icon: faPlay, labelKey: 'service.scopedToggle.enableAll' },
  { key: 'disable', enable: false, icon: faPause, labelKey: 'service.scopedToggle.disableAll' },
] as const;

/** The action awaiting confirmation: true = enable, false = disable, null = idle. */
const pending = ref<boolean | null>(null);
const submitting = ref<boolean>(false);
/** Set only when the call left services behind — the modal then explains them. */
const outcome = ref<ScopedToggleResult | null>(null);

const confirmKey = computed(() => {
  if (pending.value) {
    return props.scope === 'project'
      ? 'service.scopedToggle.enableProjectConfirm'
      : 'service.scopedToggle.enableWorkspaceConfirm';
  }
  return props.scope === 'project'
    ? 'service.scopedToggle.disableProjectConfirm'
    : 'service.scopedToggle.disableWorkspaceConfirm';
});

function ask(enable: boolean, close: () => void) {
  close();
  outcome.value = null;
  pending.value = enable;
}

function dismiss() {
  pending.value = null;
  outcome.value = null;
}

/** Falls back to the raw code so an unrecognised reason is still legible. */
function reasonLabel(reason: string): string {
  const key = `service.scopedToggle.reasons.${reason}`;
  const label = t(key);
  return label === key ? reason : label;
}

async function submit() {
  if (pending.value === null) return;
  const enable = pending.value;
  submitting.value = true;
  const result = await serviceStore.toggleServicesInScope(props.scope, props.scopeId, enable);
  submitting.value = false;

  if (!result.ok || !result.data) {
    if (result.message) notifications.show(result.message, 'error');
    dismiss();
    return;
  }

  const data = result.data;
  notifications.show(
    t(
      enable ? 'service.scopedToggle.enabledToast' : 'service.scopedToggle.disabledToast',
      { changed: data.changed, matched: data.matched }
    ),
    'success',
  );

  // Nothing left behind — the toast has said everything there is to say.
  if (data.skipped.length === 0) {
    dismiss();
    return;
  }
  outcome.value = data;
}
</script>

<template>
    <div class="px-gutter pt-4">
      <!-- Header: name + actions -->
      <div class="flex items-start justify-between gap-2 mb-3">
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <h3 class="text-sm font-semibold text-text-primary break-all">
              {{ service.name }}
            </h3>
            <SilenceBell
              resource-type="service"
              :resource-id="service.id"
              :parent-keys="serviceParentKeys"
            />
          </div>
          <p
            v-if="service.label"
            class="text-xs text-text-secondary mt-0.5"
          >
            {{ service.label }}
          </p>
        </div>
        <div class="flex items-center gap-1 ml-2 shrink-0">
          <IconButton
            v-if="canEdit && !editing"
            :fa-icon="faPenToSquare"
            :title="t('service.editScript')"
            @click="emit('edit')"
          />
          <IconButton
            :fa-icon="faXmark"
            :title="t('common.actions.close')"
            icon-class="w-4 h-4"
            @click="emit('close')"
          />
        </div>
      </div>

      <!-- Status row -->
      <div class="flex items-center justify-between gap-2 text-xs mb-3 max-md:flex-wrap">
        <span class="text-text-secondary">
          <FontAwesomeIcon :icon="faClock" class="w-3 h-3 mr-1" />
          {{ service.schedule }}
        </span>
        <div class="flex items-center gap-2">
          <span
            class="inline-flex items-center gap-1.5"
            :class="service.isActive ? 'text-status-success' : 'text-text-secondary'"
          >
            <span
              class="w-1.5 h-1.5 rounded-full"
              :class="service.isActive ? 'bg-status-success' : 'bg-text-secondary'"
            />
            {{ service.isActive ? t('common.states.active') : t('common.states.inactive') }}
          </span>
          <IconButton
            v-if="canEdit"
            :fa-icon="faBolt"
            :disabled="!canRunNow"
            :title="canRunNow ? t('service.runNow') : t('service.runNowUnavailable')"
            icon-class="w-3 h-3"
            @click="handleRunNow"
          />
          <!-- Disabling stops monitoring (outward-facing) — hold to confirm;
               enabling is a plain click. -->
          <IconButton
            v-if="canEdit"
            :fa-icon="service.isActive ? faPause : faPlay"
            :color-class="service.isActive
              ? 'text-status-warning hover:bg-status-warning/10'
              : 'text-status-success hover:bg-status-success/10'"
            :disabled="!canToggle"
            :title="service.isActive ? t('service.disable') : t('service.enable')"
            icon-class="w-3 h-3"
            :hold-offset-sec="service.isActive ? 3 : undefined"
            @click="handleToggle"
            @safe-click="handleToggle"
          />
        </div>
      </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faBolt, faClock, faPause, faPenToSquare, faPlay, faXmark } from '@fortawesome/free-solid-svg-icons';
import IconButton from '@/components/core/buttons/IconButton.vue';
import SilenceBell from '@/components/core/notifications/SilenceBell.vue';
import { useProjectStore } from '@/store/core/project';
import { useServiceStore } from '@/store/core/service';
import { useNotificationStore } from '@/store/ui/notifications';
import type { ServiceSummary } from '@/data/services/ServiceDto';

/**
 * Header of the service detail panel: name + silence bell + edit/close
 * actions, then the schedule/status row with run-now and enable/disable.
 */
const props = defineProps<{
  service: ServiceSummary;
  canEdit: boolean;
  /** Hides the edit pencil while the edit form is already open. */
  editing: boolean;
}>();

const emit = defineEmits<{
  edit: [];
  close: [];
}>();

const { t } = useI18n();
const projectStore = useProjectStore();
const serviceStore = useServiceStore();
const notifications = useNotificationStore();

/** Ancestor keys for grant checks; the owning project is in the store. */
const serviceParentKeys = computed(() => {
  const project = projectStore.projects.find(p => p.id === props.service.projectId);
  return [
    `project::${props.service.projectId}`,
    ...(project ? [`workspace::${project.workspaceId}`] : []),
  ];
});

/** Disabling is always allowed; enabling needs a script to run. */
const canToggle = computed(() => props.service.isActive || !!props.service.script);

/** A run-now only reaches dispatch when the service is active with a script. */
const canRunNow = computed(() => props.service.isActive && !!props.service.script);

async function handleRunNow() {
  const result = await serviceStore.runService(props.service.id);
  if (!result.ok) {
    if (result.message) notifications.show(result.message, 'error');
    return;
  }
  notifications.show(t('service.runNowQueued'), 'success');
}

async function handleToggle() {
  const result = await serviceStore.toggleService(props.service.id, !props.service.isActive);
  if (!result.ok && result.message) {
    notifications.show(result.message, 'error');
  }
}
</script>

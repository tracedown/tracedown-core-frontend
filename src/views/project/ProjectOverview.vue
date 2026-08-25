<template>
    <div class="flex items-stretch min-h-[60vh]">
      <!-- Service list: flush against the nav ribbon (no view padding).
           Pinned below the headbar at viewport height with its own scrollbar —
           the list never scrolls the page, only itself. -->
      <div
        class="w-2/5 shrink-0 border-r border-text-secondary/50
             sticky top-headbar self-start h-under-headbar overflow-y-auto"
      >
        <ServiceList
          :project-id="projectId"
          :selected-id="selectedServiceId"
          :can-edit="canEdit"
          @select="selectService"
          @created="onServiceCreated"
        />
      </div>

      <!-- Detail panel: a flush box filling the column, not a floating card -->
      <div class="w-3/5 min-w-0">
        <ServiceDetailPanel
          v-if="selectedService"
          :key="selectedService.id"
          :service="selectedService"
          :can-edit="canEdit"
          :initial-editing="newlyCreatedId === selectedService.id"
          @close="selectService(null)"
        />
        <EmptyState
          v-else
          :icon="faServer"
          :message="t('service.selectService')"
        />
      </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { faServer } from '@fortawesome/free-solid-svg-icons';
import EmptyState from '@/components/core/EmptyState.vue';
import ServiceList from '@/components/service/ServiceList.vue';
import ServiceDetailPanel from '@/components/service/detail/ServiceDetailPanel.vue';
import { useAuthStore } from '@/store/core/auth';
import { useServiceStore } from '@/store/core/service';
import { useResourceSearch } from '@/composables/useResourceSearch';
import { useProjectStore } from '@/store/core/project';

const { t } = useI18n();
const route = useRoute();
const authStore = useAuthStore();
const projectStore = useProjectStore();
const serviceStore = useServiceStore();

const projectId = computed(() => route.params.projectId as string);
const canEdit = computed(() => {
  const project = projectStore.projects.find(p => p.id === projectId.value);
  return authStore.canWriteScoped([
    `project::${projectId.value}`,
    ...(project ? [`workspace::${project.workspaceId}`] : []),
  ]);
});

const selectedServiceId = ref<string | null>(null);
const newlyCreatedId = ref<string | null>(null);

const selectedService = computed(() =>
  serviceStore.services.find(s => s.id === selectedServiceId.value) ?? null);

// Silent: a search-as-you-type filter refetches on every debounce tick, and the
// app's loading indicator is a full-screen overlay — flashing it per keystroke
// would obscure the very list being narrowed. The results simply swap in.
useResourceSearch((value) => {
  void serviceStore.fetchServices(projectId.value, value || undefined, { silent: true });
});

// Store-cached: a no-op unless a stale search filter is still applied.
onMounted(() => {
  void serviceStore.fetchServices(projectId.value);
});

function selectService(serviceId: string | null) {
  selectedServiceId.value = serviceId;
  if (newlyCreatedId.value !== serviceId) {
    newlyCreatedId.value = null;
  }
}

/** A just-created service opens directly in edit mode. */
function onServiceCreated(serviceId: string) {
  newlyCreatedId.value = serviceId;
  selectedServiceId.value = serviceId;
}
</script>

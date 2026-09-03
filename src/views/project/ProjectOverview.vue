<template>
    <!--  Two panes side by side on desktop; one at a time on a phone, where
          375px of list beside 560px of detail is neither. The selection model
          is untouched — the same local `selectedServiceId` decides which pane
          a phone shows, so nothing about the URL or the store changes.  -->
    <div class="flex items-stretch min-h-[60vh] max-md:block max-md:min-h-0">
      <!-- Service list: flush against the nav ribbon (no view padding).
           Pinned below the headbar at viewport height with its own scrollbar —
           the list never scrolls the page, only itself. On a phone it is the
           whole page and scrolls with it. -->
      <div
        v-if="!isMobile || !selectedService"
        class="w-2/5 shrink-0 border-r border-text-secondary/50
             sticky top-headbar self-start h-under-headbar overflow-y-auto
             max-md:w-full max-md:static max-md:h-auto max-md:overflow-visible
             max-md:border-r-0"
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
      <div
        v-if="!isMobile || selectedService"
        ref="detailPane"
        class="w-3/5 min-w-0 max-md:w-full"
      >
        <!--  The way back to the list on a phone, where the list is no longer
              on screen to click away to.  -->
        <button
          v-if="isMobile && selectedService"
          type="button"
          class="w-full flex items-center gap-2 px-gutter py-3 text-sm text-text-primary
               border-b border-text-secondary/50"
          @click="selectService(null)"
        >
          <FontAwesomeIcon
            :icon="faChevronLeft"
            class="w-3 h-3"
          />
          {{ t('service.backToServices') }}
        </button>
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
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faChevronLeft, faServer } from '@fortawesome/free-solid-svg-icons';
import EmptyState from '@/components/core/EmptyState.vue';
import ServiceList from '@/components/service/ServiceList.vue';
import ServiceDetailPanel from '@/components/service/detail/ServiceDetailPanel.vue';
import { useAuthStore } from '@/store/core/auth';
import { useServiceStore } from '@/store/core/service';
import { useResourceSearch } from '@/composables/useResourceSearch';
import { useViewport } from '@/composables/useViewport';
import { useProjectStore } from '@/store/core/project';

const { t } = useI18n();
// Not a styling switch: on a phone only one of the two panes is in the DOM at
// all, and the back control exists only there.
const { isMobile } = useViewport();
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

/** `--spacing-headbar` in pixels — the height of the sticky mobile top bar. */
const HEADBAR_PX = 64;

const detailPane = ref<HTMLElement | null>(null);
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
  if (serviceId) void revealDetailPane();
}

/**
 * On a phone the detail pane opens below the whole resource header (title,
 * stats, chart) — a tap on a service would otherwise appear to do nothing
 * because the pane that just replaced the list is a screen further down.
 * Desktop, where both panes are already in view, does not move.
 */
async function revealDetailPane() {
  if (!isMobile.value) return;
  await nextTick();
  const pane = detailPane.value;
  if (!pane) return;
  // Land below the sticky top bar (--spacing-headbar), not under it.
  const top = pane.getBoundingClientRect().top + window.scrollY - HEADBAR_PX;
  window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
}

/** A just-created service opens directly in edit mode. */
function onServiceCreated(serviceId: string) {
  newlyCreatedId.value = serviceId;
  selectedServiceId.value = serviceId;
  void revealDetailPane();
}
</script>

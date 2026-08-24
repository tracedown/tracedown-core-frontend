<template>
    <DropdownPanel
      v-if="workspaceId"
      panel-class="w-72"
      @closed="handleClosed()"
    >
      <template #trigger="{ open, toggle }">
        <button
          class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-text-secondary
               hover:bg-background-primary transition-colors"
          @click="togglePanel(open, toggle)"
        >
          <FontAwesomeIcon :icon="faFolderOpen" class="w-3.5 h-3.5" />
          <span class="text-text-primary font-medium max-w-40 truncate">
            {{ projectStore.currentProject?.name ?? t('project.select') }}
          </span>
          <FontAwesomeIcon
            :icon="open ? faChevronDown : faChevronRight"
            class="w-2.5 h-2.5"
          />
        </button>
      </template>

      <!--   Header: the panel holds one page, so search reaches the rest   -->
      <template #default="{ close }">
        <div
          class="flex items-center
            px-3 h-10
            border-b border-b-accent-secondary"
        >
          <TextInput
            v-model="search"
            compact
            class="w-full"
            autocomplete="off"
            :placeholder="t('project.searchPlaceholder')"
          />
        </div>

        <!--    List    -->
        <div class="max-h-64 overflow-y-auto">
          <button
            v-for="project in projectStore.options"
            :key="project.id"
            class="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-background-primary/50"
            :class="project.id === projectStore.selectedProjectId ? 'text-accent-primary font-medium' : 'text-text-primary'"
            @click="selectProject(project.id, close)"
          >
            {{ project.name }}
          </button>

          <div
            v-if="!projectStore.options.length"
            class="px-3 py-2 text-sm text-text-secondary"
          >
            {{ search ? t('common.states.noMatches') : t('project.noProjects') }}
          </div>
        </div>

        <!--    One page is fetched; the rest are reachable through the search    -->
        <div
          v-if="hiddenCount > 0"
          class="px-3 py-1.5 text-xs text-text-secondary border-t border-t-accent-secondary"
        >
          {{ t('common.states.moreMatches', { n: hiddenCount }) }}
        </div>
      </template>
    </DropdownPanel>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faChevronDown, faChevronRight, faFolderOpen } from '@fortawesome/free-solid-svg-icons';
import DropdownPanel from '@/components/core/DropdownPanel.vue';
import TextInput from '@/components/core/input/TextInput.vue';
import { useProjectStore } from '@/store/core/project';
import { useWorkspaceStore } from '@/store/core/workspace';

const SEARCH_DEBOUNCE_MS = 250;

const { t } = useI18n();
const router = useRouter();
const projectStore = useProjectStore();
const workspaceStore = useWorkspaceStore();

const search = ref<string>('');
const panelOpen = ref<boolean>(false);
let timer: ReturnType<typeof setTimeout> | null = null;

// The open project's own workspace covers the moment before the project view
// has selected it (deep link straight to /project/…).
const workspaceId = computed(() =>
  workspaceStore.selectedWorkspaceId ?? projectStore.currentProject?.workspaceId ?? null);

/** Projects past the fetched page — the footer says so, search reaches them. */
const hiddenCount = computed(() =>
  Math.max(projectStore.optionsTotal - projectStore.options.length, 0));

function fetchOptions(force = false) {
  if (!workspaceId.value) return;
  void projectStore.fetchProjectOptions(workspaceId.value, search.value || undefined, { force });
}

function clearTimer() {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

function togglePanel(open: boolean, toggle: () => void) {
  toggle();
  panelOpen.value = !open;
  // Only on the way in, and always fresh — a project created elsewhere since
  // the last open belongs in the list.
  if (!open) fetchOptions(true);
}

function handleClosed() {
  panelOpen.value = false;
  clearTimer();
  search.value = '';
}

function selectProject(id: string, close: () => void) {
  close();
  if (id === projectStore.selectedProjectId) return;
  // The route owns the selection; the router sets it once it resolves.
  void router.push({ name: 'project', params: { projectId: id } });
}

watch(search, () => {
  clearTimer();
  // The reset on close must not fire a fetch behind the closed panel.
  timer = setTimeout(() => {
    if (panelOpen.value) fetchOptions();
  }, SEARCH_DEBOUNCE_MS);
});

onBeforeUnmount(clearTimer);
</script>

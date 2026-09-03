<template>
    <div class="w-full bg-background-secondary border-b border-b-accent-primary">
      <div class="h-headbar px-gutter flex items-center gap-2">
        <!--  Drawer trigger. Everything the desktop headbar and ribbon offer
              lives behind it, so it is the first thing under the thumb.  -->
        <button
          type="button"
          class="shrink-0 -ml-1 p-2 rounded-lg text-text-primary
                 hover:bg-background-primary transition-colors"
          :aria-label="t('nav.openMenu')"
          :aria-expanded="menuOpen"
          @click="emit('open-menu')"
        >
          <FontAwesomeIcon
            :icon="faBars"
            class="w-4 h-4"
          />
        </button>

        <router-link
          :to="{ name: 'home' }"
          class="shrink-0"
        >
          <img
            src="/logo.svg"
            :alt="appConfig.appName"
            class="h-6 w-6"
          >
        </router-link>

        <!--  Where you are. Tapping it opens the drawer, which is where the
              org / workspace / project pickers live on a phone.  -->
        <button
          type="button"
          class="min-w-0 flex-1 text-left px-1 py-1 rounded-lg
                 hover:bg-background-primary transition-colors"
          @click="emit('open-menu')"
        >
          <span class="block text-sm font-medium text-text-primary truncate">
            {{ contextTitle }}
          </span>
          <span
            v-if="contextSubtitle"
            class="block text-xs text-text-secondary truncate"
          >
            {{ contextSubtitle }}
          </span>
        </button>

        <button
          v-if="searchStore.active"
          type="button"
          class="shrink-0 p-2 rounded-lg transition-colors hover:bg-background-primary"
          :class="searchOpen ? 'text-accent-primary' : 'text-text-secondary'"
          :aria-label="searchOpen ? t('nav.closeSearch') : t('nav.openSearch')"
          :aria-expanded="searchOpen"
          @click="searchOpen = !searchOpen"
        >
          <FontAwesomeIcon
            :icon="faMagnifyingGlass"
            class="w-4 h-4"
          />
        </button>

        <AgentHealthIndicator />

        <!--  Same host slot as the desktop headbar — icon-sized actions.  -->
        <div class="flex items-center empty:hidden">
          <SlotOutlet name="headbar-actions" />
        </div>
      </div>

      <!--  Search gets its own full-width row rather than competing with the
            context line for the 40-odd characters a phone bar has.  -->
      <div
        v-if="searchStore.active && searchOpen"
        class="px-gutter pb-2"
      >
        <SearchBar />
      </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faBars, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { appConfig } from '@/app.config';
import SearchBar from '@/components/core/search/SearchBar.vue';
import SlotOutlet from '@/components/core/SlotOutlet.vue';
import AgentHealthIndicator from '@/components/layout/navigation/AgentHealthIndicator.vue';
import { useOrgStore } from '@/store/core/org';
import { useProjectStore } from '@/store/core/project';
import { useSearchStore } from '@/store/ui/search';
import { useWorkspaceStore } from '@/store/core/workspace';

/**
 * The phone replacement for NavHeadbar + NavSidebar: a single bar carrying the
 * drawer trigger, the current org/workspace/project context, the search
 * trigger and the host action slot. Never rendered at or above the mobile
 * breakpoint — the desktop chrome is untouched.
 */
defineProps<{
  /** Drives `aria-expanded` on the drawer trigger; the parent owns the state. */
  menuOpen: boolean;
}>();

const emit = defineEmits<{
  'open-menu': [];
}>();

const { t } = useI18n();
const orgStore = useOrgStore();
const workspaceStore = useWorkspaceStore();
const projectStore = useProjectStore();
const searchStore = useSearchStore();

const searchOpen = ref<boolean>(false);

// A bar that unmounts its own search row must not leave a stale query filtering
// the view behind it.
watch(searchOpen, (open) => {
  if (!open) searchStore.reset();
});
watch(() => searchStore.active, (active) => {
  if (!active) searchOpen.value = false;
});

/** Deepest known context wins the headline; the rest becomes the trail. */
const contextTitle = computed(() =>
  projectStore.currentProject?.name
  ?? workspaceStore.currentWorkspace?.name
  ?? orgStore.currentOrg?.name
  ?? appConfig.appName);

const contextSubtitle = computed(() => {
  const trail = [orgStore.currentOrg?.name];
  if (projectStore.currentProject) trail.push(workspaceStore.currentWorkspace?.name);
  const parts = trail.filter((part): part is string => Boolean(part));
  return parts.join(' / ');
});
</script>

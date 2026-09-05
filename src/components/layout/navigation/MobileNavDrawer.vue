<template>
    <Teleport to="body">
      <div class="fixed inset-0 z-50 flex">
        <div
          class="absolute inset-0 bg-black/60 backdrop-blur-sm"
          @click="emit('close')"
        />

        <aside
          ref="panel"
          role="dialog"
          aria-modal="true"
          :aria-label="t('nav.menu')"
          class="relative w-72 max-w-[85vw] h-full flex flex-col
                 bg-background-secondary border-r border-r-accent-primary"
          @keydown.tab="trapTab"
        >
          <div class="h-headbar shrink-0 px-gutter flex items-center gap-2 border-b border-b-accent-primary">
            <!--  Mark and name link home, as they do on the desktop headbar.
                  The explicit close covers the case where home is already the
                  current route and the route watch below never fires.  -->
            <router-link
              :to="{ name: 'home' }"
              class="min-w-0 flex-1 flex items-center gap-2 -ml-1 px-1 py-1 rounded-lg
                     hover:bg-background-primary transition-colors"
              @click="emit('close')"
            >
              <img
                src="/logo.svg"
                :alt="appConfig.appName"
                class="h-6 w-6 shrink-0"
              >
              <span class="text-accent-primary font-bold text-sm truncate select-none">
                {{ appConfig.appName }}
              </span>
            </router-link>
            <button
              ref="closeButton"
              type="button"
              class="-mr-1 p-2 rounded-lg text-text-primary hover:bg-background-primary transition-colors"
              :aria-label="t('nav.closeMenu')"
              @click="emit('close')"
            >
              <FontAwesomeIcon
                :icon="faXmark"
                class="w-4 h-4"
              />
            </button>
          </div>

          <!--  Scope pickers — the desktop headbar's middle section.  -->
          <div class="shrink-0 px-gutter py-3 space-y-1 border-b border-text-secondary/25">
            <OrgSelect />
            <WorkspaceSelect />
            <ProjectSelect />
          </div>

          <!--  The ribbon, including anything a host registered into the
                navigation store. Rendered whatever `showRibbon` says: on a
                phone this drawer is the only route out of the current page.  -->
          <nav class="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
            <router-link
              v-for="item in navigationStore.visibleNavItems"
              :key="item.key"
              :to="item.route"
              class="flex items-center gap-3 p-3 rounded text-sm transition-colors"
              :class="item.key === navigationStore.activeItemKey
                ? 'bg-accent-primary/20 text-accent-primary'
                : 'text-text-secondary hover:text-text-primary hover:bg-background-primary'"
            >
              <FontAwesomeIcon
                :icon="item.icon"
                width-auto
                class="shrink-0"
              />
              <span class="truncate">{{ t(item.label) }}</span>
            </router-link>
            <div class="pt-2">
              <SlotOutlet name="nav-bottom" />
            </div>
          </nav>

          <div class="shrink-0 px-gutter py-3 border-t border-text-secondary/25">
            <UserMenu />
          </div>
        </aside>
      </div>
    </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { appConfig } from '@/app.config';
import SlotOutlet from '@/components/core/SlotOutlet.vue';
import OrgSelect from '@/components/layout/navigation/OrgSelect.vue';
import ProjectSelect from '@/components/layout/navigation/ProjectSelect.vue';
import UserMenu from '@/components/layout/navigation/UserMenu.vue';
import WorkspaceSelect from '@/components/layout/navigation/WorkspaceSelect.vue';
import { useBodyScrollLock } from '@/composables/useBodyScrollLock';
import { useNavigationStore } from '@/store/ui/navigation';

/**
 * Slide-in navigation for the mobile shell. Mounted only while open, so
 * mount/unmount is the open/close lifecycle: the scroll lock, the key
 * listener and focus restoration all hang off it.
 */
const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();
const route = useRoute();
const navigationStore = useNavigationStore();

const panel = ref<HTMLElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);

useBodyScrollLock();

// Navigating is the drawer's whole purpose — every link closes it.
watch(() => route.fullPath, () => emit('close'));

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close');
}

/**
 * Keeps Tab inside the panel. The drawer is modal, and the page behind it is
 * inert to the pointer (the backdrop swallows clicks) — letting the keyboard
 * walk out into it would leave focus somewhere invisible.
 */
function trapTab(event: KeyboardEvent) {
  const root = panel.value;
  if (!root) return;
  const focusable = root.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
  );
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

let previouslyFocused: HTMLElement | null = null;

onMounted(() => {
  previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  document.addEventListener('keydown', onKeydown);
  void nextTick(() => closeButton.value?.focus());
});

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown);
  previouslyFocused?.focus();
});
</script>

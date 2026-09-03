<template>
    <!-- Segmented pill style -->
    <div
      v-if="variant === 'pills'"
      ref="strip"
      class="inline-flex max-md:flex max-md:overflow-x-auto max-md:no-scrollbar
             bg-background-primary rounded-lg p-1 gap-1"
    >
      <button
        v-for="tab in visibleTabs"
        :key="tab.key"
        :ref="el => registerTab(tab.key, el)"
        class="px-5 py-1.5 rounded-lg text-sm transition-all select-none inline-flex items-center gap-1.5
               max-md:shrink-0 max-md:whitespace-nowrap"
        :class="model === tab.key
          ? 'bg-background-secondary font-semibold text-text-primary shadow-sm'
          : 'text-text-secondary hover:text-text-primary'"
        @click="model = tab.key"
      >
        <FontAwesomeIcon
          v-if="tab.icon"
          :icon="tab.icon"
          class="w-3 h-3"
        />
        {{ tab.label }}
      </button>
    </div>

    <!-- Underline style (default). `md` is the flush resource-header bar (the
         surrounding box draws the separator); `sm` is the compact in-panel bar
         with its own border. -->
    <div
      v-else
      ref="strip"
      class="flex items-center max-md:overflow-x-auto max-md:no-scrollbar"
      :class="size === 'md' ? 'h-12' : 'gap-1 border-b border-text-secondary/50'"
    >
      <button
        v-for="tab in visibleTabs"
        :key="tab.key"
        :ref="el => registerTab(tab.key, el)"
        class="font-medium transition-colors border-b-2 inline-flex items-center gap-1.5
               max-md:shrink-0 max-md:whitespace-nowrap"
        :class="[
          size === 'md' ? 'h-full px-gutter text-sm' : 'px-gutter py-1.5 text-xs -mb-px',
          model === tab.key
            ? 'border-accent-primary text-accent-primary'
            : 'border-transparent text-text-secondary hover:text-text-primary',
        ]"
        @click="model = tab.key"
      >
        <FontAwesomeIcon
          v-if="tab.icon"
          :icon="tab.icon"
          class="w-3 h-3"
        />
        {{ tab.label }}
      </button>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch, type ComponentPublicInstance } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { useViewport } from '@/composables/useViewport';
import type { DisplayTab } from '@/types/ui/tabs';

/**
 * Key-driven tab bar (local state — switching never navigates). The parent
 * owns the active key via v-model and switches content itself; keeping the
 * bar content-free lets it sit in a different container than the panes
 * (e.g. the resource header box vs. the tab content surface).
 *
 * Below the mobile breakpoint the strip scrolls horizontally instead of
 * wrapping — a wrapped tab bar pushes the content it labels off the first
 * screen — and the active tab is scrolled back into view when it changes.
 */
const props = withDefaults(
  defineProps<{
    tabs: DisplayTab[];
    variant?: 'underline' | 'pills';
    size?: 'sm' | 'md';
  }>(),
  {
    variant: 'underline',
    size: 'sm',
  }
);

const model = defineModel<string>({ required: true });

const visibleTabs = computed(() => props.tabs.filter(t => t.visible !== false));

const { isMobile } = useViewport();

const strip = ref<HTMLElement | null>(null);
const tabElements = new Map<string, HTMLElement>();

function registerTab(key: string, el: Element | ComponentPublicInstance | null): void {
  if (el instanceof HTMLElement) tabElements.set(key, el);
  else tabElements.delete(key);
}

/**
 * Keeps the selected tab on screen. Scrolls the strip only — `scrollIntoView`
 * on a `nearest` inline axis will not move the page, so switching a tab deep
 * in a view never yanks the viewport.
 */
watch([model, isMobile], async () => {
  if (!isMobile.value || !strip.value) return;
  await nextTick();
  tabElements.get(model.value)?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
}, { immediate: true });
</script>

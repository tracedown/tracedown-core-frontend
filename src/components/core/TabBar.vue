<template>
    <!-- Segmented pill style -->
    <div
      v-if="variant === 'pills'"
      class="inline-flex max-md:flex-wrap bg-background-primary rounded-lg p-1 gap-1"
    >
      <button
        v-for="tab in visibleTabs"
        :key="tab.key"
        class="px-5 py-1.5 rounded-lg text-sm transition-all select-none inline-flex items-center gap-1.5
               max-md:whitespace-nowrap"
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
      class="flex items-center max-md:flex-wrap"
      :class="size === 'md' ? 'h-12 max-md:h-auto' : 'gap-1 border-b border-text-secondary/50'"
    >
      <button
        v-for="tab in visibleTabs"
        :key="tab.key"
        class="font-medium transition-colors border-b-2 inline-flex items-center gap-1.5
               max-md:whitespace-nowrap"
        :class="[
          size === 'md'
            ? 'h-full px-gutter text-sm max-md:h-auto max-md:py-3'
            : 'px-gutter py-1.5 text-xs -mb-px',
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
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import type { DisplayTab } from '@/types/ui/tabs';

/**
 * Key-driven tab bar (local state — switching never navigates). The parent
 * owns the active key via v-model and switches content itself; keeping the
 * bar content-free lets it sit in a different container than the panes
 * (e.g. the resource header box vs. the tab content surface).
 *
 * Below the mobile breakpoint the strip wraps onto as many rows as it needs
 * instead of scrolling sideways: a tab hidden off the right edge is a tab
 * nobody finds, and a horizontal scroller inside a vertically scrolling page
 * is a poor target on a phone. Each button keeps its own underline, so the
 * active indicator stays under the active tab whichever row it lands on.
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
</script>

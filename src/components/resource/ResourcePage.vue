<template>
    <!-- min-h fills the viewport below the headbar so the tab background
         reaches the bottom even for short content. -->
    <div class="flex flex-col min-h-under-headbar">
      <!-- Header: one joined box flush against the ribbon and headbar —
           breadcrumbs + title, stats/graphs, then the tab bar. No margins;
           every section spaces itself with padding only. -->
      <div class="bg-background-secondary border-b border-text-secondary/50">
        <BreadcrumbsDisplay
          :title="title"
          class="px-gutter pt-6 pb-4"
        >
          <slot name="title-actions" />
          <template #controls>
            <slot name="title-controls" />
          </template>
        </BreadcrumbsDisplay>
        <slot name="stats" />
        <TabBar
          v-model="activeTab"
          :tabs="tabs"
          size="md"
        />
      </div>

      <!-- Shared surface of every tab's content. Tabs are local state — the
           resource has one URL — and only the active tab's slot renders. -->
      <div class="flex-1 bg-background-secondary/40">
        <slot :name="activeTab" />
      </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import BreadcrumbsDisplay from '@/components/layout/navigation/BreadcrumbsDisplay.vue';
import TabBar from '@/components/core/TabBar.vue';
import type { DisplayTab } from '@/types/ui/tabs';

/**
 * Scaffold of a resource view (workspace / project): header with stats slot,
 * local tabs, and one named slot per tab key. Key the component by resource id
 * upstream so tab state resets when the resource changes.
 */
const props = defineProps<{
  title: string;
  tabs: DisplayTab[];
}>();

const activeTab = ref<string>(props.tabs[0]?.key ?? 'overview');
</script>

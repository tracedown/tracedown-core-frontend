<template>
    <nav
      v-if="navigationStore.showRibbon"
      class="w-sidebar shrink-0 p-2 space-y-1 flex flex-col
           sticky top-headbar h-under-headbar
           bg-background-secondary border-r border-r-accent-primary"
    >
      <template
        v-for="(item, index) in navigationStore.visibleNavItems"
        :key="item.key"
      >
        <!-- Never above the first item: a rule there separates nothing. -->
        <div
          v-if="item.separatorBefore && index > 0"
          class="mx-2 my-2 border-t border-text-secondary/25"
        />
        <router-link
          :to="item.route"
          class="flex items-center gap-3 p-2 rounded text-sm transition-colors"
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
      </template>
      <div class="mt-auto">
        <SlotOutlet name="nav-bottom" />
      </div>
    </nav>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import SlotOutlet from '@/components/core/SlotOutlet.vue';
import { useNavigationStore } from '@/store/ui/navigation';

const { t } = useI18n();
const navigationStore = useNavigationStore();
</script>

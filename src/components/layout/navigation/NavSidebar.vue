<template>
    <nav
      v-if="navigationStore.showRibbon"
      class="w-sidebar shrink-0 p-2 space-y-1 flex flex-col
           sticky top-headbar h-under-headbar
           bg-background-secondary border-r border-r-accent-primary"
    >
      <router-link
        v-for="item in navigationStore.visibleNavItems"
        :key="item.key"
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

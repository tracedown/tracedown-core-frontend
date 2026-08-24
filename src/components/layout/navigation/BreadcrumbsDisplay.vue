<template>
    <div>
      <nav
        v-if="navigationStore.breadcrumbs.length"
        class="flex items-center gap-1.5 text-xs text-text-secondary mb-1"
      >
        <template
          v-for="(crumb, i) in navigationStore.breadcrumbs"
          :key="i"
        >
          <router-link
            v-if="crumb.to"
            :to="crumb.to"
            class="hover:text-text-primary transition-colors"
          >
            {{ crumb.label }}
          </router-link>
          <span v-else>{{ crumb.label }}</span>
          <FontAwesomeIcon :icon="faChevronRight" class="w-2 h-2" />
        </template>
        <span class="text-text-secondary">{{ title }}</span>
      </nav>
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-2 min-w-0">
          <h1 class="text-xl font-semibold text-text-primary cursor-default truncate">
            {{ title }}
          </h1>
          <!-- Inline title actions: things that read as part of the name, like
               the silence bell. They stay glued to it. -->
          <slot />
        </div>
        <!-- Trailing controls: actions ON the resource, pushed right so they
             read as a toolbar rather than as decoration of the title. -->
        <div class="flex items-center gap-2 shrink-0">
          <slot name="controls" />
        </div>
      </div>
    </div>
</template>

<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { useNavigationStore } from '@/store/ui/navigation';

/** Crumb trail (from the navigation store) topped with the current page title. */
defineProps<{
  title: string;
}>();

const navigationStore = useNavigationStore();
</script>

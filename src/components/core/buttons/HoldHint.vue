<template>
    <Transition
      enter-active-class="transition-opacity duration-150"
      leave-active-class="transition-opacity duration-300"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <span
        v-if="visible"
        role="status"
        class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none
             px-2 py-1 whitespace-nowrap
             bg-background-secondary border border-text-secondary/50 rounded-lg shadow-xl
             text-xs font-normal text-text-secondary"
      >
        {{ t('common.states.holdHint', { seconds: holdSeconds }) }}
      </span>
    </Transition>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

/**
 * The nudge shown when someone clicks a hold-to-confirm button instead of
 * holding it. Positioned against the button, and inert — it never eats the
 * next press, which is likely to be the real one.
 */
defineProps<{
  visible: boolean;
  holdSeconds: number;
}>();

const { t } = useI18n();
</script>

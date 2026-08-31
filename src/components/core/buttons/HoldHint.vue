<template>
    <Transition
      enter-active-class="transition-opacity duration-150 motion-reduce:transition-none"
      leave-active-class="transition-opacity duration-300 motion-reduce:transition-none"
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
        {{ confirmKey
          ? t('common.states.holdConfirmKey', { key: confirmKeyLabel })
          : t('common.states.holdHint', { seconds: holdSeconds }) }}
      </span>
    </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ConfirmKey } from '@/composables/useHoldGesture';

/**
 * The small message a hold-to-confirm button puts above itself. Two of them,
 * one per input modality:
 *
 * - the nudge shown when someone *clicks* instead of holding, which is a misread
 *   rather than a decision;
 * - the prompt shown while the *keyboard* confirm step is armed, which is the
 *   keyboard's equivalent of watching the ring fill. It names the key that was
 *   pressed — "Press Enter again to confirm" — because the person has already
 *   chosen a key and being offered the pair again reads as a question.
 *
 * `role="status"` so the armed prompt is announced rather than only drawn.
 * Positioned against the button and inert — it never eats the next press, which
 * is likely to be the real one.
 */
const props = defineProps<{
  visible: boolean;
  holdSeconds: number;
  /**
   * The key holding the keyboard confirm open. Set means: render the confirm
   * prompt for that key rather than the click nudge.
   */
  confirmKey?: ConfirmKey | null;
}>();

const { t } = useI18n();

// Spelled out rather than built from the token, so the key names stay
// greppable in the locale file and translatable as words.
const confirmKeyLabel = computed(() =>
  props.confirmKey === 'space' ? t('common.keys.space') : t('common.keys.enter'));
</script>

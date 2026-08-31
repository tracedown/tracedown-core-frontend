<template>
    <button
      type="button"
      class="relative p-1.5 rounded transition-colors select-none
        disabled:opacity-30 disabled:cursor-not-allowed"
      :class="[
        colorClass,
        // Keep the browser's own touch handling off a press-and-hold, or a
        // press that drifts a pixel becomes a scroll and cancels the gesture.
        holdOffsetSec != null ? 'touch-none' : '',
        // The keyboard confirm needs a state of its own: the ring only exists
        // while a pointer is down.
        hold.confirmArmed.value ? 'outline-2 outline-offset-2 outline-current' : '',
      ]"
      :disabled="disabled || (holdOffsetSec != null && !waitAfterRender)"
      :title="title"
      @click="handleClick"
      @pointerdown.left="hold.start"
      @pointerup.left="hold.release"
      @pointerleave="hold.cancel"
      @pointercancel="hold.cancel"
      @keydown="hold.keydown"
      @blur="hold.blur"
    >
      <FontAwesomeIcon
        :icon="faIcon"
        :class="iconClass"
      />

      <!-- Hold-to-confirm overlay: the same radial gesture the primary button
           uses, scaled for the icon surface. Only ever shown while holding. -->
      <span
        v-if="holdOffsetSec != null && hold.isHolding.value"
        class="absolute inset-0 flex items-center justify-center bg-black/40 rounded"
      >
        <!-- Decoration over the press: reduced motion drops the sweep. The
             icon button has no countdown digits, so the darkened overlay behind
             it stays as the static "held" state. -->
        <svg class="w-5 h-5 -rotate-90 motion-reduce:hidden">
          <circle
            class="text-white/20"
            stroke="currentColor"
            stroke-width="2.5"
            fill="transparent"
            r="8"
            cx="10"
            cy="10"
          />
          <circle
            class="text-white"
            stroke="currentColor"
            stroke-width="2.5"
            fill="transparent"
            r="8"
            cx="10"
            cy="10"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="strokeDashoffset"
            stroke-linecap="round"
          />
        </svg>
      </span>

      <!-- Clicking instead of holding is a misread, not a decision: say so.
           The same slot carries the keyboard's confirm prompt. -->
      <HoldHint
        v-if="holdOffsetSec != null"
        :visible="hold.hintVisible.value || hold.confirmArmed.value"
        :confirm-key="hold.confirmKey.value"
        :hold-seconds="holdOffsetSec"
      />
    </button>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import HoldHint from '@/components/core/buttons/HoldHint.vue';
import { useHoldGesture } from '@/composables/useHoldGesture';

/**
 * Icon-only action button (close, edit, pagination, …). Pass `holdOffsetSec`
 * to gate a destructive action behind a press-and-hold: a plain click then
 * does nothing and the action fires via `safe-click` only after the hold
 * completes — mirroring the primary DangerButton hold gesture.
 */
const props = withDefaults(
  defineProps<{
    faIcon: IconDefinition;
    title?: string;
    disabled?: boolean;
    /** Text/hover treatment; override for colored actions (danger, play/pause…). */
    colorClass?: string;
    iconClass?: string;
    /** When set, the action is hold-to-confirm and only fires via `safe-click`. */
    holdOffsetSec?: number;
  }>(),
  {
    title: undefined,
    disabled: false,
    colorClass: 'text-text-secondary hover:text-text-primary hover:bg-background-primary',
    iconClass: 'w-3.5 h-3.5',
    holdOffsetSec: undefined,
  }
);

// The native event is forwarded so listener modifiers (`@click.stop` on
// rows with their own click targets) have something to call stopPropagation
// on — a bare emit made `.stop` throw and silently drop the handler.
const emit = defineEmits<{
  click: [event: MouseEvent];
  safeClick: [];
}>();

// A hold-gated button only fires through the completed hold (pointer) or the
// two-step keyboard confirm. A plain click is swallowed (and its propagation
// stopped, so a click inside a clickable row never triggers the row) — the same
// click/hold split the primary button uses. This also absorbs the `click` a
// touch device synthesises after `pointerup`.
function handleClick(event: MouseEvent) {
  if (props.holdOffsetSec != null) {
    event.stopPropagation();
    return;
  }
  emit('click', event);
}

const hold = useHoldGesture({
  holdSeconds: () => props.holdOffsetSec,
  disabled: () => props.disabled,
  onComplete: () => emit('safeClick'),
});

const radius = 8;
const circumference = 2 * Math.PI * radius;

const strokeDashoffset = computed(() => circumference * (1 - hold.progress.value));

// Mirrors the primary button: stay disabled until the first render settles so
// a stray pointer event can't complete a zero-length hold on mount.
const waitAfterRender = ref<boolean>(false);
onMounted(async () => {
  await nextTick();
  waitAfterRender.value = true;
});
</script>

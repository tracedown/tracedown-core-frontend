<template>
    <div
      class="h-8"
      :class="fullWidth ? 'w-full' : 'min-w-30 w-fit'"
    >
      <button
        class="full relative px-3 py-1
          font-bold text-sm text-center
          rounded-lg flex gap-2 justify-center items-center
          cursor-pointer select-none

          disabled:grayscale disabled:opacity-50
          disabled:cursor-default disabled:border-0

          active:not-disabled:opacity-70"

        :class="[
          iconRight ? 'flex-row-reverse' : 'flex-row',
          // A hold must not be stolen by the browser's own touch handling —
          // without this a press that drifts a pixel becomes a scroll and the
          // gesture is cancelled.
          holdOffsetSec ? 'touch-none' : '',
          // The keyboard's armed confirm needs a visible state of its own; the
          // ring only exists while a pointer is down.
          hold.confirmArmed.value ? 'outline-2 outline-offset-2 outline-current' : '',
        ]"

        :type="type"
        :style="buttonStyle"
        :disabled="disabled || loading || !waitAfterRender"
        @click="handleClick"

        @pointerdown.left="hold.start"
        @pointerup.left="hold.release"
        @pointerleave="hold.cancel"
        @pointercancel="hold.cancel"
        @keydown="hold.keydown"
        @blur="hold.blur"
      >
        <span
          v-if="loading"
          class="inline-block h-4 w-4 rounded-full border-2 border-current/40 border-t-current
            animate-spin motion-reduce:animate-none"
        />
        <FontAwesomeIcon
          v-else-if="faIcon"
          :icon="faIcon"
          width-auto
          class="h-5"
        />
        <span v-if="labelText">
          {{ labelText }}
        </span>

        <div
          v-if="holdOffsetSec && hold.isHolding.value"
          class="absolute inset-0 flex justify-center items-center bg-black/30 rounded"
        >
          <!-- The sweeping ring is decoration over the countdown, which carries
               the same information as a number. Reduced motion drops the ring
               and keeps the number. -->
          <svg class="w-8 h-8 transform -rotate-90 motion-reduce:hidden">
            <circle
              class="text-white/20"
              stroke="currentColor"
              stroke-width="3"
              fill="transparent"
              r="12"
              cx="16"
              cy="16"
            />
            <circle
              class="text-white"
              stroke="currentColor"
              stroke-width="3"
              fill="transparent"
              r="12"
              cx="16"
              cy="16"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="strokeDashoffset"
              stroke-linecap="round"
            />
          </svg>
          <span class="absolute text-white font-bold text-sm">
            {{ hold.remainingSeconds.value }}
          </span>
        </div>

        <!-- Clicking instead of holding is a misread, not a decision: say so.
             The same slot carries the keyboard's "press again to confirm"
             prompt, since the two states are mutually exclusive. -->
        <HoldHint
          v-if="holdOffsetSec"
          :visible="hold.hintVisible.value || hold.confirmArmed.value"
          :confirm-key="hold.confirmKey.value"
          :hold-seconds="holdOffsetSec"
        />
      </button>
    </div>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onMounted, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import HoldHint from '@/components/core/buttons/HoldHint.vue';
import { useHoldGesture } from '@/composables/useHoldGesture';

/**
 * This button can be used either with default '@click' emit,
 * or it can be supplied with onClick function.
 * For buttonColor, borderColor, textColor it accepts any theme color token
 * (e.g. 'accent-primary', 'text-secondary', 'status-failure' — resolved as
 * var(--color-<token>)), or an exact color code starting with '#'.
 * */

const props = withDefaults(
  defineProps<{
    labelText: string;
    buttonColor?: string;
    borderColor?: string;
    textColor?: string;
    faIcon?: IconDefinition;
    disabled?: boolean;
    onClick?: (param?: string) => void;
    onClickParam?: string;
    holdOffsetSec?: number;
    iconRight?: boolean;
    type?: 'button' | 'submit';
    loading?: boolean;
    fullWidth?: boolean;
  }>(),
  {
    buttonColor: 'accent-secondary',
    borderColor: 'text-secondary',
    textColor: 'text-primary',
    faIcon: undefined,
    disabled: false,
    onClick: () => {},
    onClickParam: '',
    holdOffsetSec: undefined,
    iconRight: false,
    type: 'button',
    loading: false,
    fullWidth: false,
  }
);

// Emits can be defined dynamically in onClickParam
const instance = getCurrentInstance();
const emit = instance?.emit as (...args: unknown[]) => void;

const buttonStyle = computed(() => {
  return {
    color: props.textColor.startsWith('#') ?
      props.textColor :
      `var(--color-${props.textColor}, var(--color-text-primary))`,
    background: props.buttonColor.startsWith('#') ?
      props.buttonColor :
      `var(--color-${props.buttonColor}, var(--color-accent-secondary))`,
    border: props.borderColor.startsWith('#') ?
      `1px solid ${props.borderColor}` :
      `1px solid var(--color-${props.borderColor}, var(--color-text-secondary))`,
  };
});

// A hold-to-activate button only fires through the completed hold (pointer) or
// the two-step confirm (keyboard); a plain button only through click. Without
// this split, every click used to fire twice: the 0ms "hold" timer on press
// plus the click event on release. It also swallows the `click` a touch device
// synthesises after `pointerup`, and the one Enter/Space would produce — the
// keydown handler suppresses those, and this is the second line of defence.
const handleClick = () => {
  if (props.holdOffsetSec) return;
  props.onClick?.(props.onClickParam);
};

// Parameters for hold-to-activate button

const hold = useHoldGesture({
  holdSeconds: () => props.holdOffsetSec,
  disabled: () => props.disabled,
  onComplete: () => {
    emit('safeClick');
    props.onClick?.(props.onClickParam);
  },
});

const radius = 12;
const circumference = 2 * Math.PI * radius;

const strokeDashoffset = computed(() => circumference * (1 - hold.progress.value));

const waitAfterRender = ref<boolean>(false);

onMounted(async () => {
  await nextTick();
  waitAfterRender.value = true;
});
</script>

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

        :class="iconRight ? 'flex-row-reverse' : 'flex-row'"

        :type="type"
        :style="buttonStyle"
        :disabled="disabled || loading || !waitAfterRender"
        @click="handleClick"

        @mousedown.left="hold.start"
        @mouseup.left="hold.release"
        @mouseleave="hold.cancel"
      >
        <span
          v-if="loading"
          class="inline-block h-4 w-4 rounded-full border-2 border-current/40 border-t-current animate-spin"
        />
        <FontAwesomeIcon
          v-else-if="faIcon"
          :icon="faIcon"
          class="h-5"
        />
        <span v-if="labelText">
          {{ labelText }}
        </span>

        <div
          v-if="holdOffsetSec && hold.isHolding.value"
          class="absolute inset-0 flex justify-center items-center bg-black/30 rounded"
        >
          <svg class="w-8 h-8 transform -rotate-90">
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

        <!-- Clicking instead of holding is a misread, not a decision: say so. -->
        <HoldHint
          v-if="holdOffsetSec"
          :visible="hold.hintVisible.value"
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

// A hold-to-activate button only fires through the completed hold; a plain
// button only through click. Without this split, every click used to fire
// twice: the 0ms "hold" timer on mousedown plus the click event on mouseup.
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

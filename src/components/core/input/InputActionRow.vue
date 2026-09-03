<template>
    <div class="flex items-center gap-3 max-md:flex-col max-md:items-stretch">
      <TextInput
        v-model="model"
        class="flex-1"
        :compact="compact"
        :placeholder="placeholder"
        :disabled="disabled"
        @keydown.enter="trySubmit"
      />
      <PrimaryButton
        :label-text="actionLabel"
        :loading="loading"
        :disabled="!canSubmit"
        :on-click="trySubmit"
      />
      <!-- Extra controls (e.g. a cancel button) -->
      <slot />
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import TextInput from '@/components/core/input/TextInput.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';

/**
 * Text input + primary action, the shared unit of create/rename forms.
 * Enter submits. Blank input never submits; with `unchangedValue` set
 * (rename flows), an unchanged value doesn't either. `submit` carries the
 * trimmed value.
 */
const props = withDefaults(
  defineProps<{
    actionLabel: string;
    placeholder?: string;
    disabled?: boolean;
    loading?: boolean;
    compact?: boolean;
    unchangedValue?: string;
  }>(),
  {
    placeholder: undefined,
    disabled: false,
    loading: false,
    compact: false,
    unchangedValue: undefined,
  }
);

const model = defineModel<string>({ required: true });

const emit = defineEmits<{
  submit: [value: string];
}>();

const canSubmit = computed(() => {
  if (props.disabled || props.loading) return false;
  const trimmed = model.value.trim();
  if (!trimmed) return false;
  return props.unchangedValue === undefined || trimmed !== props.unchangedValue;
});

function trySubmit() {
  if (!canSubmit.value) return;
  emit('submit', model.value.trim());
}
</script>

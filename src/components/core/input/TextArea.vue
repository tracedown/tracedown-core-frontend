<template>
    <textarea
      v-model="value"
      class="w-full max-md:w-full rounded-lg px-2 py-1.5 text-sm font-mono
           bg-accent-secondary text-text-primary placeholder:text-text-secondary
           focus:outline-none focus:ring-accent-primary resize-y"
      :rows="rows"
      :placeholder="placeholder"
      :disabled="disabled"
      :name="name"
    />
</template>

<script setup lang="ts">
/** Multi-line sibling of TextInput (monospace — used for templates/JSON). */
withDefaults(
  defineProps<{
    placeholder?: string;
    disabled?: boolean;
    name?: string;
    rows?: number;
  }>(),
  {
    placeholder: '',
    disabled: false,
    name: undefined,
    rows: 4,
  }
);

const value = defineModel<string>({ required: true });
</script>

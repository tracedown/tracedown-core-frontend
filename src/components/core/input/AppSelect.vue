<template>
    <DropdownPanel
      class="max-md:w-full"
      panel-class="w-full"
      @closed="query = ''"
    >
      <template #trigger="{ toggle }">
        <button
          type="button"
          class="w-full h-8 flex items-center justify-between gap-2 px-3 rounded-lg
               focus:outline-none text-sm text-left
               bg-background-primary border border-text-secondary/50
               text-text-primary focus:border-accent-primary transition-colors"
          :class="{ 'opacity-50 cursor-not-allowed': disabled }"
          :disabled="disabled"
          @click="toggle"
        >
          <span class="truncate">{{ selectedLabel }}</span>
          <FontAwesomeIcon :icon="faChevronDown" class="w-2.5 h-2.5 text-text-secondary" />
        </button>
      </template>

      <template #default="{ close }">
        <input
          v-if="searchable"
          :ref="focusOnMount"
          v-model="query"
          type="text"
          class="w-[calc(100%-0.75rem)] mx-1.5 mb-1 px-2 py-1 text-sm rounded
               bg-background-primary border border-text-secondary/40
               text-text-primary placeholder:text-text-secondary/60
               focus:outline-none focus:border-accent-primary"
          :placeholder="t('common.actions.search')"
        >
        <div class="max-h-64 max-md:max-h-[55dvh] overflow-y-auto">
          <button
            v-for="option in filteredOptions"
            :key="option.value"
            type="button"
            class="w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-background-primary/50"
            :class="[
              isSelected(option) ? 'text-accent-primary font-medium' : 'text-text-primary',
              option.disabled ? 'opacity-50 cursor-default' : '',
            ]"
            :title="option.title"
            @click="select(option, close)"
          >
            <span class="flex items-center gap-2">
              <FontAwesomeIcon
                v-if="multiple"
                :icon="faCheck"
                class="w-3 h-3 shrink-0"
                :class="isSelected(option) ? 'opacity-100' : 'opacity-0'"
              />
              {{ option.label }}
            </span>
          </button>
          <p
            v-if="filteredOptions.length === 0"
            class="px-3 py-1.5 text-sm text-text-secondary italic"
          >
            {{ t('common.states.noMatches') }}
          </p>
        </div>
      </template>
    </DropdownPanel>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCheck, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import DropdownPanel from '@/components/core/DropdownPanel.vue';
import type { ComponentPublicInstance } from 'vue';
import type { SelectOption } from '@/types/ui/common';

const props = defineProps<{
  options: SelectOption[];
  disabled?: boolean;
  /** Shows a filter field inside the dropdown (`*input*` substring match). */
  searchable?: boolean;
  /** Multi-select: the model is a string[], picks toggle, panel stays open. */
  multiple?: boolean;
  /** Trigger text while nothing is selected (multi-select only). */
  placeholder?: string;
}>();

const model = defineModel<string | string[]>({ required: true });

const selectedValues = computed<string[]>(() =>
  Array.isArray(model.value) ? model.value : [model.value]);

function isSelected(option: SelectOption): boolean {
  return selectedValues.value.includes(option.value);
}

const { t } = useI18n();
const query = ref<string>('');

const selectedLabel = computed(() => {
  if (props.multiple) {
    const labels = selectedValues.value
      .map(value => props.options.find(o => o.value === value)?.label ?? value);
    return labels.length > 0 ? labels.join(', ') : (props.placeholder ?? '');
  }
  return props.options.find(o => o.value === model.value)?.label ?? String(model.value);
});

const filteredOptions = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!props.searchable || !q) return props.options;
  return props.options.filter(o =>
    o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
});

/** The input mounts when the panel opens — grab focus right away. */
function focusOnMount(el: Element | ComponentPublicInstance | null) {
  if (el instanceof HTMLInputElement) el.focus();
}

function select(option: SelectOption, close: () => void) {
  if (option.disabled) return;
  if (props.multiple) {
    const current = selectedValues.value;
    model.value = current.includes(option.value)
      ? current.filter(value => value !== option.value)
      : [...current, option.value];
    return; // stays open for further picks
  }
  model.value = option.value;
  close();
}
</script>

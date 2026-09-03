<template>
    <!-- Config toggle (boolean system var) -->
    <ToggleSwitch
      v-if="isConfigToggle"
      v-model="boolValue"
      :disabled="!canEdit"
    />

    <!-- Storage (read-only) -->
    <span
      v-else-if="variable.systemType === 'storage'"
      class="font-mono text-text-secondary text-xs truncate block max-w-xs"
      :title="variable.value"
    >{{ variable.value }}</span>

    <!-- Inline editing -->
    <div
      v-else-if="editing"
      class="flex items-center gap-2"
    >
      <TextInput
        v-model="draft"
        compact
        class="flex-1 font-mono"
        :placeholder="t('variables.newValuePlaceholder')"
        @keydown.enter="save"
        @keydown.escape="cancel"
      />
      <IconButton
        :fa-icon="faCheck"
        :title="t('common.actions.save')"
        color-class="text-accent-primary hover:text-accent-primary/80"
        @click="save"
      />
      <IconButton
        :fa-icon="faXmark"
        :title="t('common.actions.cancel')"
        @click="cancel"
      />
    </div>

    <!-- Display -->
    <span
      v-else-if="variable.type === 'secret'"
      class="text-text-secondary italic"
    >{{ t('variables.redacted') }}</span>
    <span
      v-else-if="variable.type === 'variable' && revealedValue == null"
      class="flex items-center gap-2"
    >
      <span class="text-text-secondary italic">{{ t('variables.encrypted') }}</span>
      <!--
        Reveal is a write-level operation: seeing a configured value in the
        clear is the same privilege as being able to replace it. A caller
        without write on this scope is refused by the API, so the button is
        not offered rather than offered and failing.
      -->
      <LinkButton
        v-if="!readonly && canEdit"
        :label-text="t('common.actions.reveal')"
        @click="emit('reveal')"
      />
    </span>
    <span
      v-else
      class="flex items-center gap-2 min-w-0"
    >
      <span class="font-mono text-text-primary break-all">{{ displayValue }}</span>
      <LinkButton
        v-if="variable.type === 'variable'"
        class="shrink-0"
        :label-text="t('common.actions.hide')"
        color-class="text-text-secondary hover:text-text-primary"
        @click="emit('hide')"
      />
    </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';
import IconButton from '@/components/core/buttons/IconButton.vue';
import LinkButton from '@/components/core/buttons/LinkButton.vue';
import TextInput from '@/components/core/input/TextInput.vue';
import ToggleSwitch from '@/components/core/input/ToggleSwitch.vue';
import type { VariableSummary } from '@/data/variables/VariableDto';

/**
 * The value of one variable, in whichever of its five shapes applies: a
 * system toggle, a read-only storage URI, the inline editor, a redacted
 * secret, or a plaintext value with its reveal/hide control.
 *
 * Split out of `VariableRow` so the same cell can be rendered inside a real
 * `<td>` (the row) and inside a `ResponsiveTable` cell slot (the variables
 * tabs) without two copies of this logic. The edit draft is local; the parent
 * owns only whether the cell is in edit mode (`v-model:editing`), which is how
 * a table can keep at most one row open at a time.
 */
const props = defineProps<{
  variable: VariableSummary;
  /** Write access on the scope that owns this value: gates edit and reveal. */
  canEdit: boolean;
  /** Inherited (ancestor-scope) value: no edit path and no reveal. */
  readonly?: boolean;
  /** Plaintext value when the variable has been revealed. */
  revealedValue?: string;
}>();

const editing = defineModel<boolean>('editing', { default: false });

const emit = defineEmits<{
  save: [value: string];
  toggle: [];
  reveal: [];
  hide: [];
}>();

const { t } = useI18n();

const draft = ref<string>('');

/**
 * Command-style model: reflects the stored value, a set emits `toggle` and
 * the switch flips when the updated variable arrives.
 */
const boolValue = computed({
  get: () => props.variable.value === 'true',
  set: () => emit('toggle'),
});

const isConfigToggle = computed(() =>
  props.variable.systemType === 'config'
  && (props.variable.value === 'true' || props.variable.value === 'false'));

const displayValue = computed(() => props.revealedValue ?? props.variable.value);

// Secrets and unrevealed variables have no readable current value — editing
// them means typing a replacement from scratch.
watch(editing, (open) => {
  draft.value = open
    ? props.revealedValue ?? (props.variable.type === 'metric' ? props.variable.value : '')
    : '';
}, { immediate: true });

function cancel() {
  editing.value = false;
}

function save() {
  const value = draft.value.trim();
  if (!value) return;
  emit('save', value);
  editing.value = false;
}
</script>

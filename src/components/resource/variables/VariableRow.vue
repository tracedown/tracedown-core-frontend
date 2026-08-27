<template>
    <tr class="border-b border-text-secondary/25 hover:bg-background-secondary/50 transition-colors">
      <td class="py-2.5 px-3 text-sm font-mono">
        <span class="inline-flex items-center gap-1.5">
          <FontAwesomeIcon
            v-if="variable.systemType"
            :icon="faLock"
            class="w-3 h-3 text-text-secondary"
            :title="t('variables.systemVariable')"
          />
          <span><span class="text-text-secondary">{{ resourcePrefix }}</span><span class="text-text-primary">{{ variable.key }}</span></span>
        </span>
      </td>
      <td class="py-2.5 px-3 text-sm">
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
            v-model="editValue"
            compact
            class="flex-1 font-mono"
            :placeholder="t('variables.newValuePlaceholder')"
            @keydown.enter="save"
            @keydown.escape="cancelEdit"
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
            @click="cancelEdit"
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
            @click="emit('reveal', variable.id)"
          />
        </span>
        <span
          v-else
          class="flex items-center gap-2"
        >
          <span class="font-mono text-text-primary">{{ displayValue }}</span>
          <LinkButton
            v-if="variable.type === 'variable'"
            :label-text="t('common.actions.hide')"
            color-class="text-text-secondary hover:text-text-primary"
            @click="emit('hide', variable.id)"
          />
        </span>
      </td>
      <td class="py-2.5 px-3">
        <BadgePill
          :color-class="typeClasses"
          :label="typeLabel"
        />
      </td>
      <td
        v-if="canEdit"
        class="py-2.5 px-3 text-right"
      >
        <div
          v-if="!variable.systemType"
          class="flex items-center justify-end gap-1"
        >
          <IconButton
            v-if="!editing"
            :fa-icon="faPenToSquare"
            :title="t('common.actions.edit')"
            @click="startEdit"
          />
          <IconButton
            :fa-icon="faTrash"
            :title="t('common.actions.delete')"
            color-class="text-text-secondary hover:text-status-failure"
            :hold-offset-sec="3"
            @safe-click="emit('delete', variable.id)"
          />
        </div>
      </td>
    </tr>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCheck, faLock, faPenToSquare, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons';
import IconButton from '@/components/core/buttons/IconButton.vue';
import LinkButton from '@/components/core/buttons/LinkButton.vue';
import TextInput from '@/components/core/input/TextInput.vue';
import ToggleSwitch from '@/components/core/input/ToggleSwitch.vue';
import type { VariableSummary, VariableType } from '@/data/variables/VariableDto';
import BadgePill from '@/components/core/BadgePill.vue';

const props = defineProps<{
  variable: VariableSummary;
  resourcePrefix: string;
  /** Write access on the scope that owns this row: gates edit, delete and reveal. */
  canEdit: boolean;
  /** Inherited (ancestor-scope) row: no edit/delete and no reveal path. */
  readonly?: boolean;
  /** Plaintext value when the variable has been revealed. */
  revealedValue?: string;
}>();

const emit = defineEmits<{
  save: [variableId: string, value: string];
  delete: [variableId: string];
  toggle: [variable: VariableSummary];
  reveal: [variableId: string];
  hide: [variableId: string];
}>();

const { t } = useI18n();

const editing = ref<boolean>(false);
const editValue = ref<string>('');

/**
 * Command-style model: reflects the stored value, a set emits `toggle` and
 * the switch flips when the updated variable arrives.
 */
const boolValue = computed({
  get: () => props.variable.value === 'true',
  set: () => emit('toggle', props.variable),
});

const isConfigToggle = computed(() =>
  props.variable.systemType === 'config'
  && (props.variable.value === 'true' || props.variable.value === 'false'));

const displayValue = computed(() => props.revealedValue ?? props.variable.value);

const typeLabel = computed(() => {
  if (props.variable.systemType) return t('variables.typeSystem');
  const labels: Record<VariableType, string> = {
    secret: t('variables.typeSecret'),
    variable: t('variables.typeVariable'),
    metric: t('variables.typeMetric'),
  };
  return labels[props.variable.type];
});

const typeClasses = computed(() => {
  if (props.variable.systemType) return 'bg-text-secondary/30 text-text-secondary';
  const classes: Record<VariableType, string> = {
    secret: 'bg-status-failure/10 text-status-failure',
    variable: 'bg-accent-primary/10 text-accent-primary',
    // accent-secondary (#3c3c3c) is invisible on dark surfaces — use the
    // bright blue text token instead.
    metric: 'bg-text-primary/10 text-text-primary',
  };
  return classes[props.variable.type];
});

function startEdit() {
  editing.value = true;
  // Secrets and unrevealed variables have no readable current value —
  // editing them means typing a replacement from scratch.
  editValue.value = props.revealedValue
    ?? (props.variable.type === 'metric' ? props.variable.value : '');
}

function cancelEdit() {
  editing.value = false;
  editValue.value = '';
}

function save() {
  const value = editValue.value.trim();
  if (!value) return;
  emit('save', props.variable.id, value);
  cancelEdit();
}
</script>

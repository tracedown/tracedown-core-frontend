<template>
    <tr class="border-b border-text-secondary/25 hover:bg-background-secondary/50 transition-colors">
      <td class="py-2.5 px-3 text-sm font-mono">
        <VariableKeyLabel
          :variable-key="variable.key"
          :resource-prefix="resourcePrefix"
          :locked="!!variable.systemType"
          :lock-title="t('variables.systemVariable')"
        />
      </td>
      <td class="py-2.5 px-3 text-sm">
        <VariableValueCell
          v-model:editing="editing"
          :variable="variable"
          :can-edit="canEdit"
          :readonly="readonly"
          :revealed-value="revealedValue"
          @save="(value) => emit('save', variable.id, value)"
          @toggle="emit('toggle', variable)"
          @reveal="emit('reveal', variable.id)"
          @hide="emit('hide', variable.id)"
        />
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
        <VariableRowActions
          v-if="!variable.systemType"
          :editing="editing"
          @edit="editing = true"
          @delete="emit('delete', variable.id)"
        />
      </td>
    </tr>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import VariableKeyLabel from '@/components/resource/variables/VariableKeyLabel.vue';
import VariableRowActions from '@/components/resource/variables/VariableRowActions.vue';
import VariableValueCell from '@/components/resource/variables/VariableValueCell.vue';
import { variableTypeClasses, variableTypeLabel } from '@/components/resource/variables/variableType';
import type { VariableSummary } from '@/data/variables/VariableDto';
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

const typeLabel = computed(() => variableTypeLabel(props.variable, t));
const typeClasses = computed(() => variableTypeClasses(props.variable));
</script>

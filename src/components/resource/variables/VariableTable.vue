<template>
    <ResponsiveTable
      :columns="columns"
      :rows="rows"
      :row-key="row => row.id"
      :table-class="tableClass"
    >
      <template #cell:key="{ row }">
        <VariableKeyLabel
          :variable-key="row.locked ? row.locked.key : row.variable!.key"
          :resource-prefix="resourcePrefix"
          :locked="!!row.locked || !!row.variable?.systemType"
          :lock-title="row.locked ? t('variables.lockedVariable') : t('variables.systemVariable')"
        />
      </template>

      <template #cell:value="{ row }">
        <span
          v-if="row.locked"
          class="font-mono text-text-secondary text-xs truncate block max-w-xs"
          :title="row.locked.description"
        >{{ row.locked.value || t('variables.lockedComputed') }}</span>
        <VariableValueCell
          v-else
          :editing="editingId === row.id"
          :variable="row.variable!"
          :can-edit="canEdit"
          :readonly="readonly"
          :revealed-value="revealedValues.get(row.id)"
          @update:editing="(open: boolean) => editingId = open ? row.id : null"
          @save="(value: string) => emit('save', row.id, value)"
          @toggle="emit('toggle', row.variable!)"
          @reveal="emit('reveal', row.id)"
          @hide="emit('hide', row.id)"
        />
      </template>

      <template #cell:type="{ row }">
        <BadgePill
          :color-class="row.locked ? LOCKED_CLASSES : variableTypeClasses(row.variable!)"
          :label="row.locked ? t('variables.typeLocked') : variableTypeLabel(row.variable!, t)"
        />
      </template>

      <!--  Conditional slot, not a hidden column: without write access there
            are no actions at all, and the desktop table drops the column
            exactly as the hand-written markup used to.  -->
      <template
        v-if="canEdit"
        #actions="{ row }"
      >
        <VariableRowActions
          v-if="row.variable && !row.variable.systemType"
          :editing="editingId === row.id"
          @edit="editingId = row.id"
          @delete="emit('delete', row.id)"
        />
      </template>
    </ResponsiveTable>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BadgePill from '@/components/core/BadgePill.vue';
import ResponsiveTable from '@/components/core/ResponsiveTable.vue';
import VariableKeyLabel from '@/components/resource/variables/VariableKeyLabel.vue';
import VariableRowActions from '@/components/resource/variables/VariableRowActions.vue';
import VariableValueCell from '@/components/resource/variables/VariableValueCell.vue';
import { variableTypeClasses, variableTypeLabel } from '@/components/resource/variables/variableType';
import type { LockedVariable, VariableSummary } from '@/data/variables/VariableDto';
import type { DataColumn } from '@/types/ui/table';

/**
 * The variables of one scope, as a table on desktop and a stacked card list on
 * a phone (`ResponsiveTable`). Locked, platform-computed variables sort to the
 * top, then system variables, then the user's own — the order the two
 * hand-written tables this replaced already used.
 *
 * At most one row edits at a time: the open row is `editingId` here rather
 * than a flag inside every row, so opening a second editor closes the first
 * instead of leaving two uncommitted drafts on screen.
 */
interface VariableTableRow {
  /** Variable id, or `locked:<key>` for a computed row (which has no id). */
  id: string;
  variable: VariableSummary | null;
  locked: LockedVariable | null;
}

const props = withDefaults(
  defineProps<{
    variables: VariableSummary[];
    /** Read-only computed variables of this scope, rendered above the rest. */
    locked?: LockedVariable[];
    /** Key prefix of the owning scope, e.g. `$o.`. */
    resourcePrefix: string;
    /** Write access on this scope: gates the actions column and reveal. */
    canEdit: boolean;
    /** Inherited (ancestor) scope: values are context, never editable. */
    readonly?: boolean;
    revealedValues: Map<string, string>;
    /** Extra classes for the desktop `<table>` (widths). */
    tableClass?: string;
  }>(),
  {
    locked: () => [],
    readonly: false,
    tableClass: 'table-fixed',
  }
);

const emit = defineEmits<{
  save: [variableId: string, value: string];
  delete: [variableId: string];
  toggle: [variable: VariableSummary];
  reveal: [variableId: string];
  hide: [variableId: string];
}>();

const { t } = useI18n();

const LOCKED_CLASSES = 'bg-text-secondary/30 text-text-secondary';

const editingId = ref<string | null>(null);

const columns = computed<DataColumn[]>(() => [
  {
    key: 'key',
    label: t('common.labels.key'),
    headerClass: 'w-1/3',
    cellClass: 'py-2.5 text-sm font-mono',
    primary: true,
  },
  { key: 'value', label: t('common.labels.value'), headerClass: 'w-1/3', cellClass: 'py-2.5 text-sm' },
  { key: 'type', label: t('common.labels.type'), headerClass: 'w-24', cellClass: 'py-2.5' },
]);

/** Locked first, then system variables, then the user's own. */
const rows = computed<VariableTableRow[]>(() => [
  ...props.locked.map(locked => ({ id: `locked:${locked.key}`, variable: null, locked })),
  ...[...props.variables]
    .sort((a, b) => (a.systemType ? 0 : 1) - (b.systemType ? 0 : 1))
    .map(variable => ({ id: variable.id, variable, locked: null })),
]);
</script>

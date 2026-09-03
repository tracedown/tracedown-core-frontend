<template>
    <!--  Desktop: the table the view used to write by hand.  -->
    <table
      v-if="!isMobile"
      class="w-full"
      :class="tableClass"
    >
      <thead>
        <tr class="border-b border-text-secondary/50">
          <th
            v-for="column in columns"
            :key="column.key"
            class="text-left text-xs font-medium text-text-secondary uppercase tracking-wider py-2 px-3"
            :class="column.headerClass"
          >
            {{ column.label }}
          </th>
          <th
            v-if="$slots.actions"
            class="w-20"
          />
        </tr>
      </thead>
      <tbody>
        <template
          v-for="row in rows"
          :key="rowKey(row)"
        >
          <tr
            class="border-b border-text-secondary/15"
            :class="clickable ? 'cursor-pointer hover:bg-background-primary/50' : ''"
            @click="emit('row-click', row)"
          >
            <td
              v-for="column in columns"
              :key="column.key"
              class="py-2 px-3"
              :class="column.cellClass"
            >
              <slot
                :name="`cell:${column.key}`"
                :row="row"
              />
            </td>
            <td
              v-if="$slots.actions"
              class="py-2 px-3 text-right"
            >
              <slot
                name="actions"
                :row="row"
              />
            </td>
          </tr>
          <tr v-if="$slots.expanded && expandedKey === rowKey(row)">
            <td :colspan="columns.length + ($slots.actions ? 1 : 0)">
              <slot
                name="expanded"
                :row="row"
              />
            </td>
          </tr>
        </template>
      </tbody>
    </table>

    <!--  Mobile: one stacked card per row. A four-column table on a 390px
          screen either overflows sideways or shrinks past legibility; the
          card keeps every value on screen with its own label.  -->
    <ul
      v-else
      class="border-y border-text-secondary/25 divide-y divide-text-secondary/15"
    >
      <li
        v-for="row in rows"
        :key="rowKey(row)"
        class="py-3"
        :class="clickable ? 'cursor-pointer' : ''"
        @click="emit('row-click', row)"
      >
        <div
          v-if="primaryColumn"
          class="text-sm font-medium text-text-primary mb-1.5 break-words"
        >
          <slot
            :name="`cell:${primaryColumn.key}`"
            :row="row"
          />
        </div>

        <div class="space-y-1">
          <div
            v-for="column in cardColumns"
            :key="column.key"
            class="flex items-start justify-between gap-3 text-xs"
          >
            <span class="shrink-0 text-text-secondary">{{ column.label }}</span>
            <span class="min-w-0 text-right break-words text-text-primary">
              <slot
                :name="`cell:${column.key}`"
                :row="row"
              />
            </span>
          </div>
        </div>

        <div
          v-if="$slots.actions"
          class="mt-2 flex justify-end"
        >
          <slot
            name="actions"
            :row="row"
          />
        </div>

        <div
          v-if="$slots.expanded && expandedKey === rowKey(row)"
          class="mt-2"
        >
          <slot
            name="expanded"
            :row="row"
          />
        </div>
      </li>
    </ul>
</template>

<script setup lang="ts" generic="T">
import { computed } from 'vue';
import { useViewport } from '@/composables/useViewport';
import type { DataColumn } from '@/types/ui/table';

/**
 * The shared table shape: a real `<table>` on desktop, a stacked card list
 * below the mobile breakpoint. Cells stay the view's business — every column
 * renders through a `#cell:<key>` scoped slot, so adopting this in place of
 * hand-written `<table>` markup is a mechanical move of the existing `<td>`
 * contents, with no change to what a row looks like on a wide screen.
 *
 * ```vue
 * <ResponsiveTable :columns="columns" :rows="entries" :row-key="e => e.id">
 *   <template #cell:name="{ row }">{{ row.name }}</template>
 *   <template #actions="{ row }"><IconButton … /></template>
 * </ResponsiveTable>
 * ```
 */
const props = withDefaults(
  defineProps<{
    columns: DataColumn[];
    rows: T[];
    /** Stable identity per row — also matched against `expandedKey`. */
    rowKey: (row: T) => string;
    /** Key of the row whose `#expanded` content is showing, if any. */
    expandedKey?: string | null;
    /** Marks rows as interactive (pointer + hover) and emits `row-click`. */
    clickable?: boolean;
    /** Extra classes for the desktop `<table>` (widths, `table-fixed`). */
    tableClass?: string;
  }>(),
  {
    expandedKey: null,
    clickable: false,
    tableClass: '',
  }
);

const emit = defineEmits<{
  'row-click': [row: T];
}>();

const { isMobile } = useViewport();

/** Headline of the mobile card; falls back to no headline at all. */
const primaryColumn = computed(() => props.columns.find(column => column.primary));

/** Label/value rows of the mobile card — everything but the headline. */
const cardColumns = computed(() => props.columns.filter(column =>
  !column.mobileHidden && column !== primaryColumn.value));
</script>

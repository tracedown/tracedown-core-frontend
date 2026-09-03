<template>
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-1">
        <span class="text-xs text-text-secondary">{{ t(labelKey) }}</span>
        <HelpTooltip :entries="help" />
      </div>
      <!--  The width lives on the wrapper, not the select: below the
            breakpoint a select stretches to its container, and one that
            stretched here would start at a different x on every row.  -->
      <div class="w-28 shrink-0">
        <AppSelect
          v-model="display"
          :options="options"
          :disabled="disabled || floor.level >= 2"
          :title="floor.level >= 2
            ? t('permissions.grantedBy', { group: floor.source })
            : undefined"
        />
      </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import AppSelect from '@/components/core/input/AppSelect.vue';
import HelpTooltip from '@/components/core/HelpTooltip.vue';
import type { AccessSection, SectionFloor } from '@/types/access';
import type { HelpEntry } from '@/types/ui/help';
import type { SelectOption } from '@/types/ui/common';

/**
 * One section row of the permission matrix: label + level help + select.
 * The select displays the effective level (own vs group floor — most
 * permissive wins); choices below the floor are disabled with the granting
 * group named, and a write-level floor disables the whole select.
 */
const props = withDefaults(
  defineProps<{
    section: AccessSection;
    labelKey: string;
    disabled?: boolean;
    floor?: SectionFloor;
  }>(),
  {
    disabled: false,
    floor: () => ({ level: 0, source: '' }),
  }
);

/** The member's own stored level; the floor only affects presentation. */
const level = defineModel<number>({ required: true });

const { t } = useI18n();

const display = computed({
  get: () => String(Math.max(level.value, props.floor.level)),
  set: (value: string) => {
    level.value = Number(value);
  },
});

const options = computed<SelectOption[]>(() => (
  [
    { value: '0', label: t('permissions.none') },
    { value: '1', label: t('permissions.read') },
    { value: '2', label: t('permissions.write') },
  ].map(option => Number(option.value) < props.floor.level
    ? { ...option, disabled: true, title: t('permissions.grantedBy', { group: props.floor.source }) }
    : option)
));

const help = computed<HelpEntry[]>(() => [
  { term: t('permissions.none'), description: t(`permissions.help.${props.section}.none`) },
  { term: t('permissions.read'), description: t(`permissions.help.${props.section}.read`) },
  { term: t('permissions.write'), description: t(`permissions.help.${props.section}.write`) },
]);
</script>

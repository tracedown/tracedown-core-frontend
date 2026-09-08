<template>
    <div class="space-y-2">
      <PermissionRow
        v-for="section in sections"
        :key="section.key"
        v-model="levels[section.key]"
        :section="section.key"
        :label-key="section.labelKey"
        :disabled="disabled"
        :floor="floors?.[section.key]"
      />
    </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue';
import PermissionRow from '@/components/users/PermissionRow.vue';
import { getPermissionSections } from '@/config/permissionSections';
import type { OrgSectionPermissions } from '@/data/orgs/PermissionDto';
import type { AccessSection, SectionFloor } from '@/types/access';

/**
 * Editor for the five org-section levels (0 none / 1 read / 2 write).
 * `floors` are group-derived minimums (most permissive wins) — presentation
 * is handled per row.
 */
defineProps<{
  disabled?: boolean;
  floors?: Partial<Record<AccessSection, SectionFloor>>;
}>();

const model = defineModel<OrgSectionPermissions>({ required: true });

const sections = getPermissionSections();

function sectionLevel(key: AccessSection) {
  return computed<number>({
    // A section the host registered after this row was stored has no key on
    // the wire from an older server; "no level" is level 0, not NaN.
    get: () => model.value[key] ?? 0,
    set: (value) => {
      model.value = { ...model.value, [key]: value };
    },
  });
}

/** Writable per-section bindings — reactive() unwraps the computeds so the rows can v-model them. */
const levels = reactive(
  Object.fromEntries(sections.map(section => [section.key, sectionLevel(section.key)])),
) as unknown as Record<AccessSection, number>;
</script>

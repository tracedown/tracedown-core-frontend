<template>
    <div class="px-gutter py-4 space-y-4">
      <SectionHeading :label="t('nav.audit')" />

      <!-- Filters -->
      <div class="flex items-end gap-2 flex-wrap max-md:flex-col max-md:items-stretch">
        <div>
          <p class="text-xs text-text-secondary mb-1">
            {{ t('audit.filterAction') }}
          </p>
          <TextInput
            v-model="actionFilter"
            class="w-44"
            compact
            :placeholder="t('audit.actionPlaceholder')"
          />
        </div>
        <div>
          <p class="text-xs text-text-secondary mb-1">
            {{ t('audit.filterEntity') }}
          </p>
          <AppSelect
            v-model="entityFilter"
            class="w-44"
            searchable
            :options="entityOptions"
          />
        </div>
        <div v-if="actorOptions.length > 1">
          <p class="text-xs text-text-secondary mb-1">
            {{ t('audit.filterActor') }}
          </p>
          <AppSelect
            v-model="actorFilter"
            class="w-52"
            searchable
            :options="actorOptions"
          />
        </div>
      </div>

      <LoadingState v-if="auditStore.loading && auditStore.entries.length === 0" />
      <EmptyState
        v-else-if="auditStore.entries.length === 0"
        compact
        :message="t('audit.none')"
      />
      <ResponsiveTable
        v-else
        :columns="columns"
        :rows="auditStore.entries"
        :row-key="(entry: AuditLogEntry) => entry.id"
        :expanded-key="expandedId"
        clickable
        table-class="table-fixed"
        @row-click="(entry: AuditLogEntry) => expandedId = expandedId === entry.id ? null : entry.id"
      >
        <template #cell:time="{ row }">
          {{ formatTime(row.createdAt) }}
        </template>
        <template #cell:actor="{ row }">
          {{ actorLabel(row) }}
        </template>
        <template #cell:action="{ row }">
          <code class="text-xs font-mono text-text-primary">{{ row.action }}</code>
        </template>
        <template #cell:entity="{ row }">
          <template v-if="row.entityType">
            {{ row.entityType }}
            <!-- The name the entity had at the time reads far better than its
                 raw id; fall back to the id only when no name was recorded. -->
            <span
              v-if="row.entityDisplayName"
              class="text-text-primary"
            >{{ row.entityDisplayName }}</span>
            <span
              v-else-if="row.entityId"
              class="font-mono"
            >{{ row.entityId }}</span>
          </template>
        </template>
        <template #expanded="{ row }">
          <AuditEntryDetail :entry="row" />
        </template>
      </ResponsiveTable>

      <TablePager
        :page="auditStore.page"
        :page-size="50"
        :total="auditStore.total"
        @change="(p: number) => auditStore.fetchEntries(p)"
      />
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import SectionHeading from '@/components/core/SectionHeading.vue';
import LoadingState from '@/components/core/LoadingState.vue';
import EmptyState from '@/components/core/EmptyState.vue';
import TextInput from '@/components/core/input/TextInput.vue';
import AppSelect from '@/components/core/input/AppSelect.vue';
import ResponsiveTable from '@/components/core/ResponsiveTable.vue';
import TablePager from '@/components/core/TablePager.vue';
import AuditEntryDetail from '@/components/audit/AuditEntryDetail.vue';
import { useAuditStore } from '@/store/core/audit';
import { useOrgUserStore } from '@/store/core/orgUser';
import { useAuthStore } from '@/store/core/auth';
import type { AuditLogEntry } from '@/data/audit/AuditDto';
import type { DataColumn } from '@/types/ui/table';
import type { SelectOption } from '@/types/ui/common';

/**
 * Org audit log: PFS table, newest first, filterable by action substring,
 * entity type, and actor. Rows expand to the diff/comment payload.
 */
const { t } = useI18n();
const auditStore = useAuditStore();
const orgUserStore = useOrgUserStore();
const authStore = useAuthStore();

/**
 * Entity types the backend actually writes (extracted from AuditService.log
 * call sites). Silences are deliberately absent — personal preferences are
 * not audited.
 */
const ENTITY_TYPES = [
  'agent', 'api-key', 'domain', 'grafana-integration', 'group', 'invite',
  'notification-template', 'org', 'project', 'rule-preset', 'service',
  'user', 'webhook', 'webhook-binding', 'workspace',
];

const actionFilter = ref<string>('');
const entityFilter = ref<string>('');
const actorFilter = ref<string>('');
const expandedId = ref<string | null>(null);

// The action code is the headline of the mobile card; the rest become its
// labelled rows.
const columns = computed<DataColumn[]>(() => [
  { key: 'time', label: t('audit.time'), headerClass: 'w-40', cellClass: 'text-xs text-text-secondary tabular-nums' },
  { key: 'actor', label: t('audit.actor'), headerClass: 'w-52', cellClass: 'text-sm text-text-primary truncate' },
  { key: 'action', label: t('audit.action'), headerClass: 'w-56', primary: true },
  { key: 'entity', label: t('audit.entity'), cellClass: 'text-xs text-text-secondary truncate' },
]);

const entityOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('audit.allEntities') },
  ...ENTITY_TYPES.map(type => ({ value: type, label: type })),
]);

const actorOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('audit.allActors') },
  ...orgUserStore.users.map(u => ({ value: u.userId, label: `${u.displayName} (${u.email})` })),
]);

const timeFmt = new Intl.DateTimeFormat(undefined, {
  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

function actorLabel(entry: AuditLogEntry): string {
  if (entry.actorName) return entry.actorName;
  if (entry.actorEmail) return entry.actorEmail;
  return entry.userId ? entry.userId : t('audit.system');
}

function refetch() {
  void auditStore.fetchEntries(1, {
    action: actionFilter.value || undefined,
    entityType: entityFilter.value || undefined,
    actorUserId: actorFilter.value || undefined,
  });
}

let debounce: ReturnType<typeof setTimeout> | undefined;
watch(actionFilter, () => {
  clearTimeout(debounce);
  debounce = setTimeout(refetch, 300);
});
watch([entityFilter, actorFilter], refetch);

// A pending debounce must not fire after navigating away.
onUnmounted(() => clearTimeout(debounce));

onMounted(() => {
  refetch();
  // Actor filter needs the member list; skip silently without users.read.
  if (authStore.canRead('users')) {
    void orgUserStore.fetchUsers({ silent: true });
  }
});
</script>

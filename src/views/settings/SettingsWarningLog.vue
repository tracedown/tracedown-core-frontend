<template>
    <div class="px-gutter py-4 space-y-3">
      <SectionHeading :label="t('systemAlerts.logTitle')" />
      <p class="text-sm text-text-secondary max-w-2xl">
        {{ t('systemAlerts.logHint') }}
      </p>

      <LoadingState v-if="loading && entries.length === 0" />
      <EmptyState
        v-else-if="entries.length === 0"
        compact
        :message="t('systemAlerts.logEmpty')"
      />
      <template v-else>
        <ResponsiveTable
          :columns="columns"
          :rows="entries"
          :row-key="(entry: SystemAlertSummary) => entry.id"
          table-class="max-w-4xl text-sm"
        >
          <template #cell:type="{ row }">
            {{ typeLabel(row.alertType) }}
          </template>
          <template #cell:severity="{ row }">
            <BadgePill
              :color-class="row.severity === 'error'
                ? 'bg-status-failure/10 text-status-failure'
                : 'bg-status-warning/10 text-status-warning'"
              :label="t(`systemAlerts.severity.${row.severity}`, row.severity)"
            />
          </template>
          <template #cell:subject="{ row }">
            {{ row.subject || '—' }}
          </template>
          <template #cell:firstSeen="{ row }">
            {{ formatTime(row.createdAt) }}
          </template>
          <template #cell:lastSeen="{ row }">
            {{ formatTime(row.lastSeenAt) }}
          </template>
        </ResponsiveTable>
        <TablePager
          :page="page"
          :page-size="PAGE_SIZE"
          :total="total"
          @change="loadPage"
        />
      </template>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import SectionHeading from '@/components/core/SectionHeading.vue';
import LoadingState from '@/components/core/LoadingState.vue';
import EmptyState from '@/components/core/EmptyState.vue';
import BadgePill from '@/components/core/BadgePill.vue';
import ResponsiveTable from '@/components/core/ResponsiveTable.vue';
import TablePager from '@/components/core/TablePager.vue';
import { useSystemAlertStore } from '@/store/core/systemAlert';
import { useNotificationStore } from '@/store/ui/notifications';
import type { DataColumn } from '@/types/ui/table';
import type { SystemAlertSummary } from '@/data/alerts/SystemAlertDto';

/**
 * Warning log: full history of platform-alert episodes (capacity, agent
 * health). Banners show only the latest per type — this is the durable
 * record.
 */
const { t } = useI18n();
const systemAlertStore = useSystemAlertStore();
const notifications = useNotificationStore();

const PAGE_SIZE = 50;

// The alert type is the headline of the mobile card; severity and the two
// timestamps become its labelled rows.
const columns = computed<DataColumn[]>(() => [
  { key: 'severity', label: t('systemAlerts.colSeverity') },
  { key: 'type', label: t('systemAlerts.colType'), cellClass: 'text-text-primary', primary: true },
  { key: 'subject', label: t('systemAlerts.colSubject'), cellClass: 'font-mono text-xs text-text-secondary' },
  { key: 'firstSeen', label: t('systemAlerts.colFirstSeen'), cellClass: 'text-text-secondary tabular-nums' },
  { key: 'lastSeen', label: t('systemAlerts.colLastSeen'), cellClass: 'text-text-secondary tabular-nums' },
]);

const entries = ref<SystemAlertSummary[]>([]);
const page = ref<number>(1);
const total = ref<number>(0);
const loading = ref<boolean>(true);

const timeFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

function typeLabel(alertType: string): string {
  const key = `systemAlerts.types.${alertType}`;
  const label = t(key);
  return label === key ? alertType : label;
}

async function loadPage(newPage: number) {
  loading.value = true;
  try {
    const result = await systemAlertStore.fetchHistory(newPage, PAGE_SIZE);
    if (!result.ok || !result.data) {
      if (result.message) notifications.show(result.message, 'error');
      return;
    }
    entries.value = result.data.items;
    total.value = result.data.total;
    page.value = newPage;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadPage(1);
});
</script>

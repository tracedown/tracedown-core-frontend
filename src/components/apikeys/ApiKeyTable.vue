<template>
    <ResponsiveTable
      :columns="columns"
      :rows="keys"
      :row-key="(key: ApiKeySummary) => key.id"
      table-class="text-sm"
    >
      <template #cell:organization="{ row }">
        <span class="block min-w-0 max-w-48 truncate max-md:max-w-none max-md:whitespace-normal">{{ row.organizationName }}</span>
      </template>
      <template #cell:user="{ row }">
        <!-- Rows arrive grouped by user: on a wide screen the name heads its
             group once and is kept for screen readers on the rest; a phone
             card stands alone, so it always says whose. -->
        <span
          class="block min-w-0 max-w-48 max-md:max-w-none"
          :class="starts.has(row.id) ? '' : 'md:sr-only'"
        >
          <span class="block truncate max-md:whitespace-normal">{{ userLabel(row, t('apiKeys.erasedUser')) }}</span>
          <span
            v-if="row.createdByName && row.createdByEmail"
            class="block truncate text-xs text-text-secondary max-md:whitespace-normal"
          >{{ row.createdByEmail }}</span>
        </span>
      </template>
      <template #cell:name="{ row }">
        <span class="block min-w-0 max-w-56 truncate max-md:max-w-none max-md:whitespace-normal">{{ row.name }}</span>
      </template>
      <template #cell:prefix="{ row }">
        <code class="font-mono text-xs text-text-secondary">{{ row.prefix ? t('apiKeys.prefixEllipsis', { prefix: row.prefix }) : t('common.none') }}</code>
      </template>
      <template #cell:access="{ row }">
        {{ t(`apiKeys.access.${row.access}`) }}
      </template>
      <template #cell:state="{ row }">
        <BadgePill
          :color-class="isOrphaned(row) ? ORPHANED_COLOR : STATE_COLORS[row.state]"
          :label="t(stateLabelKey(row))"
          :title="t(stateHintKey(row, perspective, manageable))"
        />
        <span
          v-if="showsStateHint(row)"
          class="block mt-1 max-w-64 text-xs text-text-secondary max-md:max-w-none"
        >{{ t(stateHintKey(row, perspective, manageable)) }}</span>
      </template>
      <template #cell:lastUsed="{ row }">
        {{ row.lastUsedAt ? formatDateTime(row.lastUsedAt) : t('apiKeys.neverUsed') }}
      </template>
      <template #cell:expires="{ row }">
        {{ row.expiresAt ? formatDate(row.expiresAt) : t('apiKeys.never') }}
      </template>
      <template #cell:created="{ row }">
        {{ formatDate(row.createdAt) }}
      </template>
      <template
        v-if="manageable || activityLinks"
        #actions="{ row }"
      >
        <div class="flex items-center justify-end gap-1">
          <RouterLink
            v-if="activityLinks"
            :to="{ name: 'audit', query: { apiKeyId: row.id } }"
            class="p-1.5 rounded text-text-secondary hover:text-accent-primary transition-colors"
            :title="t('apiKeys.activity')"
            :aria-label="t('apiKeys.activity')"
          >
            <FontAwesomeIcon :icon="faClockRotateLeft" />
          </RouterLink>
          <template v-if="manageable">
            <SecondaryButton
              v-if="!row.revoked"
              :label-text="t('apiKeys.revoke')"
              :fa-icon="faBan"
              :hold-offset-sec="3"
              @safe-click="emit('revoke', row)"
            />
            <IconButton
              :fa-icon="faTrash"
              :title="t('common.actions.delete')"
              :aria-label="t('common.actions.delete')"
              color-class="text-text-secondary hover:text-status-failure"
              :hold-offset-sec="3"
              @safe-click="emit('delete', row)"
            />
          </template>
        </div>
      </template>
    </ResponsiveTable>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faBan, faClockRotateLeft, faTrash } from '@fortawesome/free-solid-svg-icons';
import ResponsiveTable from '@/components/core/ResponsiveTable.vue';
import BadgePill from '@/components/core/BadgePill.vue';
import IconButton from '@/components/core/buttons/IconButton.vue';
import SecondaryButton from '@/components/core/buttons/SecondaryButton.vue';
import type { ApiKeyState, ApiKeySummary } from '@/data/apikeys/ApiKeyDto';
import type { DataColumn } from '@/types/ui/table';
import { formatDate, formatDateTime } from '@/lib/dateFormat';
import {
  groupStarts, isOrphaned, showsStateHint, stateHintKey, stateLabelKey, userLabel,
} from '@/lib/apiKeys';
import type { ApiKeyPerspective } from '@/lib/apiKeys';

/**
 * API keys as a table, for both lists of them. `perspective: 'own'` is the
 * signed-in user's keys, each row naming the organization it acts in;
 * `'oversight'` is every key acting in the current organization, each row
 * naming the member it acts as, grouped by member. Revoke and delete are
 * hold-to-confirm and offered only when `manageable`; `activityLinks` adds a
 * link to each key's entries in the audit log.
 */
const props = defineProps<{
  keys: ApiKeySummary[];
  perspective: ApiKeyPerspective;
  manageable: boolean;
  activityLinks?: boolean;
}>();

const emit = defineEmits<{
  revoke: [key: ApiKeySummary];
  delete: [key: ApiKeySummary];
}>();

const { t } = useI18n();

const STATE_COLORS: Record<ApiKeyState, string> = {
  active: 'bg-status-success/10 text-status-success',
  revoked: 'bg-status-failure/10 text-status-failure',
  expired: 'bg-status-warning/10 text-status-warning',
  inactive: 'bg-text-secondary/15 text-text-secondary',
};
const ORPHANED_COLOR = 'bg-text-secondary/15 text-text-secondary';

// The key's name is the headline of the mobile card.
const columns = computed<DataColumn[]>(() => [
  props.perspective === 'own'
    ? { key: 'organization', label: t('apiKeys.columns.organization'), cellClass: 'text-text-primary' }
    : { key: 'user', label: t('apiKeys.columns.user'), headerClass: 'w-48', cellClass: 'text-text-primary' },
  { key: 'name', label: t('apiKeys.columns.name'), primary: true, cellClass: 'text-text-primary' },
  { key: 'prefix', label: t('apiKeys.columns.prefix') },
  { key: 'access', label: t('apiKeys.columns.access'), cellClass: 'text-text-secondary' },
  { key: 'state', label: t('apiKeys.columns.state') },
  { key: 'lastUsed', label: t('apiKeys.columns.lastUsed'), cellClass: 'text-xs text-text-secondary tabular-nums' },
  { key: 'expires', label: t('apiKeys.columns.expires'), cellClass: 'text-xs text-text-secondary tabular-nums' },
  {
    key: 'created', label: t('apiKeys.columns.created'), mobileHidden: true,
    cellClass: 'text-xs text-text-secondary tabular-nums',
  },
]);

const starts = computed(() => groupStarts(props.keys));
</script>

<template>
    <div class="px-gutter py-4 space-y-3">
      <SectionHeading :label="t('apiKeys.orgTitle')" />
      <p class="text-sm text-text-secondary max-w-2xl">
        {{ t('apiKeys.orgHint') }}
      </p>

      <div class="flex items-end gap-2 flex-wrap max-md:flex-col max-md:items-stretch">
        <div v-if="userOptions.length > 1">
          <p class="text-xs text-text-secondary mb-1">
            {{ t('apiKeys.filterUser') }}
          </p>
          <AppSelect
            v-model="userFilter"
            class="w-52"
            searchable
            :aria-label="t('apiKeys.filterUser')"
            :options="userOptions"
          />
        </div>
        <div>
          <p class="text-xs text-text-secondary mb-1">
            {{ t('apiKeys.filterPrefix') }}
          </p>
          <TextInput
            v-model="prefixFilter"
            class="w-44"
            compact
            autocomplete="off"
            :maxlength="KEY_PREFIX_LENGTH"
            :aria-label="t('apiKeys.filterPrefix')"
            :placeholder="t('apiKeys.prefixPlaceholder')"
          />
        </div>
      </div>

      <ApiKeyLoadError
        v-if="apiKeyStore.orgError !== null"
        :message="apiKeyStore.orgError"
        @retry="load(apiKeyStore.orgPage)"
      />
      <LoadingState v-if="apiKeyStore.orgLoading && apiKeyStore.orgKeys.length === 0" />
      <EmptyState
        v-else-if="apiKeyStore.orgKeys.length === 0 && apiKeyStore.orgError === null"
        compact
        :message="filtered ? t('apiKeys.noneMatching') : t('apiKeys.noneInOrg')"
      />
      <template v-else-if="apiKeyStore.orgKeys.length > 0">
        <!-- Eight columns and the actions do not fit 768–1023px: the table
             scrolls inside its box, never the page. -->
        <div class="overflow-x-auto">
          <ApiKeyTable
            :keys="apiKeyStore.orgKeys"
            perspective="oversight"
            :manageable="authStore.canWrite('settings')"
            activity-links
            @revoke="handleRevoke"
            @delete="handleDelete"
          />
        </div>
        <TablePager
          :page="apiKeyStore.orgPage"
          :page-size="DEFAULT_PAGE_SIZE"
          :total="apiKeyStore.orgTotal"
          @change="load"
        />
      </template>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import SectionHeading from '@/components/core/SectionHeading.vue';
import LoadingState from '@/components/core/LoadingState.vue';
import EmptyState from '@/components/core/EmptyState.vue';
import TablePager from '@/components/core/TablePager.vue';
import AppSelect from '@/components/core/input/AppSelect.vue';
import TextInput from '@/components/core/input/TextInput.vue';
import ApiKeyTable from '@/components/apikeys/ApiKeyTable.vue';
import ApiKeyLoadError from '@/components/apikeys/ApiKeyLoadError.vue';
import { KEY_PREFIX_LENGTH, useApiKeyStore } from '@/store/core/apiKey';
import { useAuthStore } from '@/store/core/auth';
import { useOrgUserStore } from '@/store/core/orgUser';
import { useNotificationStore } from '@/store/ui/notifications';
import type { ApiKeySummary } from '@/data/apikeys/ApiKeyDto';
import type { OrgUserSummary } from '@/data/orgs/PermissionDto';
import type { SelectOption } from '@/types/ui/common';
import { actionToastKey } from '@/lib/apiKeys';
import { DEFAULT_PAGE_SIZE } from '@/utils/pfs';

/**
 * The organization's oversight of its API keys: every key acting in it,
 * whoever holds it, grouped by the member each acts as, filterable by member
 * and by key prefix. Seeing them needs `settings` read; revoking or deleting
 * one needs `settings` write. There is no create here — a key is only ever
 * minted by the member it acts as, from their own account.
 */
const { t } = useI18n();
const apiKeyStore = useApiKeyStore();
const authStore = useAuthStore();
const orgUserStore = useOrgUserStore();
const notifications = useNotificationStore();

const userFilter = ref<string>('');
const prefixFilter = ref<string>('');
/** Every member, not just the first page the member list holds. */
const members = ref<OrgUserSummary[]>([]);

const userOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('apiKeys.allUsers') },
  ...members.value.map(u => ({ value: u.userId, label: t('apiKeys.labels.member', { name: u.displayName, email: u.email }) })),
]);

const filtered = computed(() => userFilter.value !== '' || prefixFilter.value.trim() !== '');

function load(page = 1) {
  void apiKeyStore.fetchOrgKeys(page, {
    userId: userFilter.value || undefined,
    prefix: prefixFilter.value.trim() || undefined,
  });
}

let debounce: ReturnType<typeof setTimeout> | undefined;
watch(userFilter, () => load(1));
watch(prefixFilter, () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => load(1), 300);
});
onUnmounted(() => clearTimeout(debounce));

async function handleRevoke(key: ApiKeySummary) {
  const result = await apiKeyStore.revokeOrgKey(key.id);
  if (!result.ok) {
    notifications.show(result.message ?? t('apiKeys.actionFailed'), 'error');
    return;
  }
  notifications.show(t(actionToastKey('revoke', result.alreadyGone), { name: key.name }), 'success');
}

async function handleDelete(key: ApiKeySummary) {
  const result = await apiKeyStore.deleteOrgKey(key.id);
  if (!result.ok) {
    notifications.show(result.message ?? t('apiKeys.actionFailed'), 'error');
    return;
  }
  notifications.show(t(actionToastKey('delete', result.alreadyGone), { name: key.name }), 'success');
}

onMounted(() => {
  load();
  // The member filter needs the member list; it stays hidden without users.read.
  if (authStore.canRead('users')) {
    void orgUserStore.fetchOrgUserChoices().then((result) => {
      if (result.ok && result.data) members.value = result.data;
    });
  }
});
</script>

<template>
    <div class="px-gutter py-4 space-y-3">
      <div class="flex items-center justify-between gap-3">
        <SectionHeading :label="t('apiKeys.ownTitle')" />
        <span :title="mintHint || undefined">
          <PrimaryButton
            :label-text="t('apiKeys.create')"
            :fa-icon="faPlus"
            :disabled="mintHint !== ''"
            :on-click="() => (minting = true)"
          />
        </span>
      </div>

      <p class="text-sm text-text-secondary max-w-2xl">
        {{ t('apiKeys.ownHint') }}
      </p>

      <p
        v-if="enrolmentNeeded"
        role="alert"
        class="text-sm text-status-warning max-w-2xl"
      >
        {{ t('apiKeys.enrolmentNeeded', { org: orgStore.currentOrg?.name ?? orgStore.orgName ?? '' }) }}
      </p>

      <ApiKeyLoadError
        v-if="apiKeyStore.ownError !== null"
        :message="apiKeyStore.ownError"
        @retry="load(apiKeyStore.ownPage)"
      />
      <LoadingState v-if="apiKeyStore.ownLoading && apiKeyStore.ownKeys.length === 0" />
      <EmptyState
        v-else-if="apiKeyStore.ownKeys.length === 0 && apiKeyStore.ownError === null"
        compact
        :message="t('apiKeys.none')"
      />
      <template v-else-if="apiKeyStore.ownKeys.length > 0">
        <ApiKeyTable
          :keys="apiKeyStore.ownKeys"
          perspective="own"
          manageable
          @revoke="handleRevoke"
          @delete="handleDelete"
        />
        <TablePager
          :page="apiKeyStore.ownPage"
          :page-size="DEFAULT_PAGE_SIZE"
          :total="apiKeyStore.ownTotal"
          @change="load"
        />
      </template>

      <ApiKeyMintDialog
        v-if="minting"
        @close="minting = false"
      />
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import SectionHeading from '@/components/core/SectionHeading.vue';
import LoadingState from '@/components/core/LoadingState.vue';
import EmptyState from '@/components/core/EmptyState.vue';
import TablePager from '@/components/core/TablePager.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import ApiKeyTable from '@/components/apikeys/ApiKeyTable.vue';
import ApiKeyLoadError from '@/components/apikeys/ApiKeyLoadError.vue';
import ApiKeyMintDialog from '@/components/account/ApiKeyMintDialog.vue';
import { useApiKeyStore } from '@/store/core/apiKey';
import { useAuthStore } from '@/store/core/auth';
import { useOrgStore } from '@/store/core/org';
import { useNotificationStore } from '@/store/ui/notifications';
import { useFeatureGate } from '@/composables/useFeatureGate';
import type { ApiKeySummary } from '@/data/apikeys/ApiKeyDto';
import { actionToastKey } from '@/lib/apiKeys';
import { DEFAULT_PAGE_SIZE } from '@/utils/pfs';

/**
 * The signed-in user's own API keys, across every organization they belong
 * to. Keys are minted here, in the session's current organization, and
 * revoked or deleted here.
 */
const { t } = useI18n();
const apiKeyStore = useApiKeyStore();
const authStore = useAuthStore();
const orgStore = useOrgStore();
const notifications = useNotificationStore();
const createGate = useFeatureGate('apiKey.create');

const minting = ref<boolean>(false);

/** Why minting is unavailable, or empty while it is open. */
const mintHint = computed(() => {
  if (!orgStore.selectedOrgId) return t('apiKeys.noOrgSelected');
  return createGate.value.enabled ? '' : createGate.value.hint;
});

/**
 * The current organization requires two-factor sign-in and this user has not
 * enrolled: their keys there show active, yet every request is refused.
 */
const enrolmentNeeded = computed(() =>
  orgStore.totpRequired === true
  && authStore.user != null
  && !authStore.user.totpEnabled
  && apiKeyStore.ownKeys.some(k => k.organizationId === orgStore.selectedOrgId && k.state === 'active'));

function load(page = 1) {
  void apiKeyStore.fetchOwnKeys(page);
}

async function handleRevoke(key: ApiKeySummary) {
  const result = await apiKeyStore.revokeOwnKey(key.id);
  if (!result.ok) {
    notifications.show(result.message ?? t('apiKeys.actionFailed'), 'error');
    return;
  }
  notifications.show(t(actionToastKey('revoke', result.alreadyGone), { name: key.name }), 'success');
}

async function handleDelete(key: ApiKeySummary) {
  const result = await apiKeyStore.deleteOwnKey(key.id);
  if (!result.ok) {
    notifications.show(result.message ?? t('apiKeys.actionFailed'), 'error');
    return;
  }
  notifications.show(t(actionToastKey('delete', result.alreadyGone), { name: key.name }), 'success');
}

onMounted(() => {
  load();
  // Whether the organization requires two-factor sign-in, for the warning above.
  if (orgStore.selectedOrgId && orgStore.totpRequired === null) void orgStore.fetchSettings({ silent: true });
});
</script>

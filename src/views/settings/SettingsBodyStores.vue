<template>
    <div class="px-gutter py-4 space-y-8">
      <!-- The environment-configured default: not a row, not editable here. -->
      <div class="space-y-2 max-w-3xl">
        <SectionHeading :label="t('bodyStores.defaultTitle')" />
        <p class="text-sm text-text-secondary">
          {{ t('bodyStores.defaultHint') }}
        </p>
        <div
          v-if="bodyStoreStore.defaultStore"
          class="flex items-center gap-3 py-2 max-md:flex-wrap"
        >
          <BadgePill
            class="shrink-0"
            color-class="bg-text-secondary/10 text-text-secondary"
            :label="kindLabel(bodyStoreStore.defaultStore.kind)"
          />
          <span class="text-xs text-text-secondary font-mono truncate">
            {{ bodyStoreLocationLabel(bodyStoreStore.defaultStore) }}
          </span>
        </div>
        <p
          v-else-if="defaultFailed"
          class="text-xs text-status-warning"
        >
          {{ t('bodyStores.defaultUnavailable') }}
        </p>
      </div>

      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <SectionHeading :label="t('bodyStores.title')" />
          <PrimaryButton
            v-if="canManage"
            :label-text="t('bodyStores.add')"
            :fa-icon="faPlus"
            :on-click="() => editing = 'new'"
          />
        </div>
        <p class="text-sm text-text-secondary max-w-3xl">
          {{ t('bodyStores.hint') }}
        </p>

        <LoadingState v-if="bodyStoreStore.loading && bodyStoreStore.stores.length === 0" />
        <EmptyState
          v-else-if="bodyStoreStore.stores.length === 0"
          compact
          :message="t('bodyStores.none')"
        />
        <ul
          v-else
          class="divide-y divide-text-secondary/15 max-w-3xl"
        >
          <BodyStoreRow
            v-for="store in bodyStoreStore.stores"
            :key="store.id"
            :store="store"
            :can-manage="canManage"
            @edit="editing = store"
          />
        </ul>
      </div>

      <BodyStoreDialog
        v-if="editing !== null"
        :store="editing === 'new' ? null : editing"
        @close="editing = null"
        @saved="editing = null"
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
import BadgePill from '@/components/core/BadgePill.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import BodyStoreRow from '@/components/settings/bodyStores/BodyStoreRow.vue';
import BodyStoreDialog from '@/components/settings/bodyStores/BodyStoreDialog.vue';
import { useBodyStoreStore } from '@/store/core/bodyStore';
import { useAuthStore } from '@/store/core/auth';
import { useNotificationStore } from '@/store/ui/notifications';
import { BODY_STORE_KINDS, bodyStoreLocationLabel } from '@/data/bodyStores/BodyStoreDto';
import type { BodyStoreSummary } from '@/data/bodyStores/BodyStoreDto';

/**
 * Settings → Body storage: the default store (read-only) and the stores agents
 * can be assigned to write response bodies into. Managed with the same
 * permission as the agent fleet.
 */
const { t } = useI18n();
const bodyStoreStore = useBodyStoreStore();
const authStore = useAuthStore();
const notifications = useNotificationStore();

const canManage = computed(() => authStore.canWrite('settings'));

/** The store in the dialog: a row, `'new'` for the add dialog, or null when closed. */
const editing = ref<BodyStoreSummary | 'new' | null>(null);
const defaultFailed = ref<boolean>(false);

function kindLabel(kind: string): string {
  return (BODY_STORE_KINDS as string[]).includes(kind) ? t(`bodyStores.kinds.${kind}`) : kind;
}

onMounted(async () => {
  const [list, fallback] = await Promise.all([bodyStoreStore.fetchStores(), bodyStoreStore.fetchDefault()]);
  defaultFailed.value = !fallback.ok;
  if (!list.ok && list.message) notifications.show(list.message, 'error');
});
</script>

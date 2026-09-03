<template>
    <div class="px-gutter py-4 space-y-8">
      <!-- Key list -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <SectionHeading :label="t('apiKeys.title')" />
          <CreateToggleButton
            v-model="createOpen"
            :label-text="t('apiKeys.create')"
          />
        </div>

        <div class="space-y-3 max-w-xl">
          <template v-if="createOpen">
            <div class="flex items-end gap-2 flex-wrap max-md:flex-col max-md:items-stretch">
              <div>
                <p class="text-xs text-text-secondary mb-1">
                  {{ t('apiKeys.name') }}
                </p>
                <TextInput
                  v-model="newName"
                  class="w-48"
                  :placeholder="t('apiKeys.namePlaceholder')"
                />
              </div>
              <div>
                <p class="text-xs text-text-secondary mb-1">
                  {{ t('apiKeys.expiry') }}
                </p>
                <AppSelect
                  v-model="newExpiry"
                  class="w-36"
                  :options="EXPIRY_OPTIONS"
                />
              </div>
              <PrimaryButton
                :label-text="t('common.actions.create')"
                :loading="creating"
                :disabled="!newName.trim()"
                :on-click="handleCreate"
              />
            </div>
          </template>

          <!-- Show-once key -->
          <div
            v-if="issued"
            class="rounded-lg border border-status-warning/40 bg-status-warning/5 p-4 space-y-2"
          >
            <p class="text-sm text-text-primary">
              {{ t('apiKeys.issued', { name: issued.name }) }}
            </p>
            <div class="flex items-center gap-2">
              <code class="min-w-0 text-xs font-mono text-text-primary bg-background-primary rounded px-2 py-1.5 break-all">
                {{ issued.key }}
              </code>
              <IconButton
                :fa-icon="faCopy"
                :title="t('common.actions.copy')"
                color-class="text-text-secondary hover:text-accent-primary"
                @click="copyKey"
              />
            </div>
            <p class="text-xs text-text-secondary">
              {{ t('apiKeys.issuedHint') }}
            </p>
          </div>
        </div>

        <LoadingState v-if="apiKeyStore.loading && apiKeyStore.keys.length === 0" />
        <EmptyState
          v-else-if="apiKeyStore.keys.length === 0"
          compact
          :message="t('apiKeys.none')"
        />
        <ul
          v-else
          class="divide-y divide-text-secondary/15 max-w-3xl"
        >
          <li
            v-for="key in apiKeyStore.keys"
            :key="key.id"
            class="flex items-center gap-3 py-2.5 max-md:flex-wrap"
            :class="{ 'opacity-50': key.revoked }"
          >
            <div class="min-w-0 max-md:w-full">
              <p class="text-sm text-text-primary truncate">
                {{ key.name }}
              </p>
              <p class="text-xs text-text-secondary">
                {{ metaLine(key) }}
              </p>
            </div>
            <BadgePill
              v-if="key.revoked"
              class="shrink-0"
              color-class="bg-status-failure/10 text-status-failure"
              :label="t('apiKeys.revoked')"
            />
            <BadgePill
              v-else-if="isExpired(key)"
              class="shrink-0"
              color-class="bg-status-warning/10 text-status-warning"
              :label="t('apiKeys.expired')"
            />
            <div class="flex items-center gap-1 ml-auto shrink-0">
              <SecondaryButton
                v-if="!key.revoked"
                :label-text="t('apiKeys.revoke')"
                :fa-icon="faBan"
                :hold-offset-sec="3"
                @safe-click="handleRevoke(key)"
              />
              <IconButton
                :fa-icon="faTrash"
                :title="t('common.actions.delete')"
                color-class="text-text-secondary hover:text-status-failure"
                :hold-offset-sec="3"
                @safe-click="handleDelete(key)"
              />
            </div>
          </li>
        </ul>
      </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { faBan, faCopy, faTrash } from '@fortawesome/free-solid-svg-icons';
import SectionHeading from '@/components/core/SectionHeading.vue';
import LoadingState from '@/components/core/LoadingState.vue';
import EmptyState from '@/components/core/EmptyState.vue';
import BadgePill from '@/components/core/BadgePill.vue';
import IconButton from '@/components/core/buttons/IconButton.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import SecondaryButton from '@/components/core/buttons/SecondaryButton.vue';
import CreateToggleButton from '@/components/core/buttons/CreateToggleButton.vue';
import TextInput from '@/components/core/input/TextInput.vue';
import AppSelect from '@/components/core/input/AppSelect.vue';
import { useApiKeyStore } from '@/store/core/apiKey';
import { useNotificationStore } from '@/store/ui/notifications';
import type { ApiKeySummary } from '@/data/apikeys/ApiKeyDto';
import type { SelectOption } from '@/types/ui/common';

/** Org API keys tab: list / show-once create / revoke / delete. */
const { t } = useI18n();
const apiKeyStore = useApiKeyStore();
const notifications = useNotificationStore();

const EXPIRY_OPTIONS: SelectOption[] = [
  { value: '', label: t('apiKeys.never') },
  { value: '30', label: t('apiKeys.days', { n: 30 }) },
  { value: '90', label: t('apiKeys.days', { n: 90 }) },
  { value: '365', label: t('apiKeys.days', { n: 365 }) },
];

const createOpen = ref<boolean>(false);
const newName = ref<string>('');
const newExpiry = ref<string>('');
const creating = ref<boolean>(false);
const issued = ref<ApiKeySummary | null>(null);

const dateFmt = computed(() => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }));

function isExpired(key: ApiKeySummary): boolean {
  return key.expiresAt != null && new Date(key.expiresAt).getTime() < Date.now();
}

function metaLine(key: ApiKeySummary): string {
  const parts = [`${t('apiKeys.created')} ${dateFmt.value.format(new Date(key.createdAt))}`];
  parts.push(key.lastUsedAt
    ? `${t('apiKeys.lastUsed')} ${dateFmt.value.format(new Date(key.lastUsedAt))}`
    : t('apiKeys.neverUsed'));
  if (key.expiresAt) parts.push(`${t('apiKeys.expires')} ${dateFmt.value.format(new Date(key.expiresAt))}`);
  return parts.join(' · ');
}

async function handleCreate() {
  if (creating.value) return;
  creating.value = true;
  try {
    const result = await apiKeyStore.createKey({
      name: newName.value.trim(),
      expiresInDays: newExpiry.value ? Number(newExpiry.value) : undefined,
    });
    if (!result.ok || !result.data) {
      notifications.show(result.message ?? t('common.states.error'), 'error');
      return;
    }
    issued.value = result.data;
    newName.value = '';
    createOpen.value = false;
  } finally {
    creating.value = false;
  }
}

async function handleRevoke(key: ApiKeySummary) {
  const result = await apiKeyStore.revokeKey(key.id);
  if (!result.ok && result.message) notifications.show(result.message, 'error');
}

async function handleDelete(key: ApiKeySummary) {
  const result = await apiKeyStore.deleteKey(key.id);
  if (!result.ok && result.message) notifications.show(result.message, 'error');
}

async function copyKey() {
  if (!issued.value?.key) return;
  await navigator.clipboard.writeText(issued.value.key);
  notifications.show(t('common.states.copied'), 'success');
}

onMounted(() => {
  void apiKeyStore.fetchKeys();
});
</script>

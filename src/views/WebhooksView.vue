<template>
    <div class="px-gutter py-4 space-y-8">
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <SectionHeading :label="t('nav.webhooks')" />
          <CreateToggleButton
            v-if="canManage"
            v-model="createOpen"
            :label-text="t('webhooks.create')"
          />
        </div>
        <p class="text-sm text-text-secondary max-w-2xl">
          {{ t('webhooks.pageHint') }}
        </p>

        <!-- Extension point: a host may inject webhook-setup helpers here. -->
        <SlotOutlet
          v-if="canManage"
          name="webhook-presets"
          :slot-props="{ orgId: orgStore.orgId }"
        />

        <WebhookForm
          v-if="createOpen"
          :submitting="saving"
          @submit="handleCreate"
          @cancel="createOpen = false"
        />

        <LoadingState v-if="webhookStore.loading && webhookStore.webhooks.length === 0" />
        <EmptyState
          v-else-if="webhookStore.webhooks.length === 0"
          compact
          :message="t('webhooks.none')"
        />
        <ul
          v-else
          class="divide-y divide-text-secondary/15 max-w-3xl"
        >
          <li
            v-for="webhook in webhookStore.webhooks"
            :key="webhook.id"
          >
            <div class="flex items-center gap-3 py-2.5">
              <div class="min-w-0">
                <p class="text-sm text-text-primary truncate">
                  {{ webhook.name }}
                  <BadgePill
                    v-if="webhook.label"
                    class="ml-1"
                    color-class="bg-text-secondary/10 text-text-secondary"
                    :label="webhook.label"
                  />
                </p>
                <p class="text-xs text-text-secondary truncate font-mono">
                  {{ webhook.method }} {{ webhook.url }}
                </p>
              </div>
              <span class="text-xs text-text-secondary ml-auto shrink-0">
                {{ t('webhooks.attemptsLabel', { n: webhook.attemptCount }) }}
              </span>
              <template v-if="canManage">
                <IconButton
                  :fa-icon="faPen"
                  :title="t('common.actions.edit')"
                  color-class="text-text-secondary hover:text-accent-primary"
                  icon-class="w-3.5 h-3.5"
                  @click="editingId = editingId === webhook.id ? null : webhook.id"
                />
                <IconButton
                  :fa-icon="faTrash"
                  :title="t('common.actions.delete')"
                  color-class="text-text-secondary hover:text-status-failure"
                  icon-class="w-3.5 h-3.5"
                  :hold-offset-sec="3"
                  @safe-click="handleDelete(webhook)"
                />
              </template>
            </div>

            <div
              v-if="editingId === webhook.id"
              class="pb-4"
            >
              <WebhookForm
                :initial="webhook"
                :submitting="saving"
                @submit="(payload) => handleUpdate(webhook, payload)"
                @cancel="editingId = null"
              />
              <WebhookVariablesPanel
                :webhook-id="webhook.id"
                :can-edit="canManage"
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
import { faPen, faTrash } from '@fortawesome/free-solid-svg-icons';
import SectionHeading from '@/components/core/SectionHeading.vue';
import LoadingState from '@/components/core/LoadingState.vue';
import EmptyState from '@/components/core/EmptyState.vue';
import BadgePill from '@/components/core/BadgePill.vue';
import IconButton from '@/components/core/buttons/IconButton.vue';
import CreateToggleButton from '@/components/core/buttons/CreateToggleButton.vue';
import SlotOutlet from '@/components/core/SlotOutlet.vue';
import WebhookForm from '@/components/webhooks/WebhookForm.vue';
import WebhookVariablesPanel from '@/components/webhooks/WebhookVariablesPanel.vue';
import { useWebhookStore } from '@/store/core/webhook';
import { useAuthStore } from '@/store/core/auth';
import { useOrgStore } from '@/store/core/org';
import { useNotificationStore } from '@/store/ui/notifications';
import type { CreateWebhookRequest, WebhookSummary } from '@/data/webhooks/WebhookDto';

/**
 * Org webhook delivery channels: definitions live here; which resources a
 * webhook fires for is bound per workspace/project/service (§16.5).
 */
const { t } = useI18n();
const webhookStore = useWebhookStore();
const authStore = useAuthStore();
const orgStore = useOrgStore();
const notifications = useNotificationStore();

const canManage = computed(() => authStore.canWrite('webhooks'));

const createOpen = ref<boolean>(false);
const editingId = ref<string | null>(null);
const saving = ref<boolean>(false);

async function handleCreate(payload: CreateWebhookRequest) {
  saving.value = true;
  try {
    const result = await webhookStore.createWebhook(payload);
    if (!result.ok) {
      notifications.show(result.message ?? t('common.states.error'), 'error');
      return;
    }
    createOpen.value = false;
  } finally {
    saving.value = false;
  }
}

async function handleUpdate(webhook: WebhookSummary, payload: CreateWebhookRequest) {
  saving.value = true;
  try {
    const result = await webhookStore.updateWebhook(webhook.id, payload);
    if (!result.ok) {
      notifications.show(result.message ?? t('common.states.error'), 'error');
      return;
    }
    editingId.value = null;
  } finally {
    saving.value = false;
  }
}

async function handleDelete(webhook: WebhookSummary) {
  const result = await webhookStore.deleteWebhook(webhook.id);
  if (!result.ok && result.message) notifications.show(result.message, 'error');
}

onMounted(() => {
  void webhookStore.fetchWebhooks();
});
</script>

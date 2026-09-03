<template>
    <div class="space-y-8 max-w-3xl">
      <div class="border-b border-text-secondary/50 p-6 max-md:p-4">
        <h2 class="text-lg font-semibold text-text-primary mb-4">
          {{ t('settings.rename') }}
        </h2>
        <InputActionRow
          v-model="name"
          :placeholder="t('settings.renamePlaceholder')"
          :action-label="t('common.actions.save')"
          :disabled="!canEdit"
          :unchanged-value="resourceName"
          @submit="handleRename"
        />
      </div>

      <div
        v-if="resourceType && resourceId"
        class="border-b border-text-secondary/50 p-6 max-md:p-4"
      >
        <WebhookBindings
          :resource-type="resourceType"
          :resource-id="resourceId"
        />
      </div>

      <div
        v-if="resourceType === 'project' && resourceId"
        class="border-b border-text-secondary/50 p-6 max-md:p-4"
      >
        <GrafanaIntegrationCard
          :project-id="resourceId"
          :can-edit="canEdit"
        />
      </div>

      <div
        v-if="canEdit"
        class="border-y border-status-failure/30 p-6 max-md:p-4"
      >
        <h2 class="text-lg font-semibold text-status-failure mb-2">
          {{ t('settings.dangerZone') }}
        </h2>
        <p class="text-sm text-text-secondary mb-4">
          {{ t('settings.deleteConfirm') }}
        </p>
        <DangerButton
          :label-text="t('settings.deleteButton')"
          :hold-offset-sec="3"
          @safe-click="handleDelete"
        />
      </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import DangerButton from '@/components/core/buttons/DangerButton.vue';
import WebhookBindings from '@/components/webhooks/WebhookBindings.vue';
import GrafanaIntegrationCard from '@/components/settings/GrafanaIntegrationCard.vue';
import { useNotificationStore } from '@/store/ui/notifications';
import type { ActionResult } from '@/types/actions';
import InputActionRow from '@/components/core/input/InputActionRow.vue';

/**
 * Shared settings tab: rename, webhook bindings (when the resource identity
 * is provided), and a hold-to-confirm delete. The owning view supplies the
 * store calls; deletion navigates home on success.
 */
const props = defineProps<{
  resourceName: string;
  canEdit: boolean;
  onRename: (name: string) => Promise<ActionResult>;
  onDelete: () => Promise<ActionResult>;
  /** Identity for the webhook-bindings section; omit to hide it. */
  resourceType?: 'workspace' | 'project' | 'service';
  resourceId?: string;
}>();

const { t } = useI18n();
const router = useRouter();
const notifications = useNotificationStore();

const name = ref<string>(props.resourceName);

watch(() => props.resourceName, (newName) => {
  name.value = newName;
});

async function handleRename() {
  const result = await props.onRename(name.value.trim());
  if (!result.ok) {
    if (result.message) notifications.show(result.message, 'error');
    return;
  }
  notifications.show(t('settings.renamed'), 'success');
}

async function handleDelete() {
  const result = await props.onDelete();
  if (!result.ok) {
    if (result.message) notifications.show(result.message, 'error');
    return;
  }
  notifications.show(t('settings.deleted'), 'success');
  void router.push({ name: 'home' });
}
</script>

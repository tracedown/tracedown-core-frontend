<template>
    <div
      v-if="systemAlertStore.alerts.length > 0"
      class="w-full"
    >
      <div
        v-for="alert in systemAlertStore.alerts"
        :key="alert.id"
        class="flex items-center gap-3 border px-3 py-2"
        :class="alert.severity === 'error'
          ? 'border-status-failure/40 bg-status-failure/10'
          : 'border-status-warning/40 bg-status-warning/10'"
      >
        <FontAwesomeIcon
          :icon="faTriangleExclamation"
          class="w-4 h-4 shrink-0"
          :class="alert.severity === 'error' ? 'text-status-failure' : 'text-status-warning'"
        />
        <p class="text-sm text-text-primary min-w-0">
          {{ messageOf(alert) }}
        </p>
        <IconButton
          class="ml-auto shrink-0"
          :fa-icon="faXmark"
          :title="t('common.actions.dismiss')"
          color-class="text-text-secondary hover:text-text-primary"
          @click="handleDismiss(alert)"
        />
      </div>
    </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faTriangleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons';
import IconButton from '@/components/core/buttons/IconButton.vue';
import { useSystemAlertStore } from '@/store/core/systemAlert';
import { useNotificationStore } from '@/store/ui/notifications';
import type { SystemAlertSummary } from '@/data/alerts/SystemAlertDto';

/**
 * Dismissable platform-alert banners (dispatch capacity, agent health).
 * Rendered only for users who can act on them — the store's fetch is gated
 * by settings write access, everyone else keeps an empty list. Dismissal is
 * per user and holds for the current episode of the condition.
 */
const { t } = useI18n();
const systemAlertStore = useSystemAlertStore();
const notifications = useNotificationStore();

const timeFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function messageOf(alert: SystemAlertSummary): string {
  const since = timeFmt.format(new Date(alert.createdAt));
  switch (alert.alertType) {
    case 'dispatch_capacity':
      return t('systemAlerts.dispatchCapacity', { since });
    case 'agent_down':
      return t('systemAlerts.agentDown', { agent: alert.subject, since });
    case 'agent_degraded':
      return t('systemAlerts.agentDegraded', {
        agent: alert.subject,
        ms: (alert.data?.roundTripMs as number | undefined) ?? '?',
        since,
      });
    case 'no_eligible_agent':
      return t('systemAlerts.noEligibleAgent', { since });
    case 'agent_dispatch_failed':
      return t('systemAlerts.agentDispatchFailed', { since });
    case 'health_token_unavailable':
      return t('systemAlerts.healthTokenUnavailable', { endpoint: alert.subject, since });
    case 'scheduler_error':
      return t('systemAlerts.schedulerError', { since });
    case 'result_ingest_failed':
      return t('systemAlerts.resultIngestFailed', { since });
    case 'outbox_consumer_stalled':
      return t('systemAlerts.outboxConsumerStalled', { consumers: alert.subject, since });
    default:
      return t('systemAlerts.generic', { type: alert.alertType, since });
  }
}

async function handleDismiss(alert: SystemAlertSummary) {
  const result = await systemAlertStore.dismiss(alert.id);
  if (!result.ok && result.message) notifications.show(result.message, 'error');
}
</script>

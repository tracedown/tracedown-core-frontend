<template>
    <div
      v-if="handoff.mode === 'dashboard'"
      class="rounded-lg bg-background-primary p-3 space-y-2"
    >
      <p class="text-xs text-text-secondary">
        {{ t('domains.handoffHint', { provider: handoff.providerName }) }}
      </p>
      <PrimaryButton
        :label-text="t('domains.handoffAction', { provider: handoff.providerName })"
        :loading="checking"
        :on-click="open"
      />
      <p
        v-if="awaiting"
        class="text-xs text-text-secondary"
      >
        {{ t('domains.handoffWaiting', { provider: handoff.providerName }) }}
        <LinkButton
          :label-text="t('domains.handoffCheckNow')"
          @click="checkNow"
        />
      </p>
      <p
        v-if="error"
        class="text-xs text-status-failure"
      >
        {{ error }}
      </p>
    </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import LinkButton from '@/components/core/buttons/LinkButton.vue';
import { useDomainStore } from '@/store/core/domain';
import { useNotificationStore } from '@/store/ui/notifications';
import type { DnsHandoff, DomainSummary } from '@/data/domains/DomainDto';

/**
 * Opens the page where this domain's DNS records are edited, when the provider
 * is one we recognise. The record is still pasted by hand — this only saves
 * hunting for the right page — so nothing here needs a credential.
 *
 * Renders nothing for an unrecognised provider, leaving the manual
 * instructions above it to stand on their own.
 */
const props = defineProps<{
  domain: DomainSummary;
}>();

const emit = defineEmits<{
  verified: [];
}>();

const { t } = useI18n();
const domainStore = useDomainStore();
const notifications = useNotificationStore();

const handoff = ref<DnsHandoff>({ mode: 'none' });
const awaiting = ref<boolean>(false);
const checking = ref<boolean>(false);
const error = ref<string | null>(null);

/** They add the record in another tab, so the result arrives by polling. */
const POLL_INTERVAL_MS = 6000;
const POLL_ATTEMPTS = 10;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let attemptsLeft = 0;

onMounted(async () => {
  const result = await domainStore.fetchDnsHandoff(props.domain.id);
  if (result.ok && result.data) handoff.value = result.data;
});

onBeforeUnmount(stopPolling);

function stopPolling() {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
  attemptsLeft = 0;
}

function open() {
  if (!handoff.value.url) return;
  error.value = null;
  window.open(handoff.value.url, '_blank', 'noopener,noreferrer');
  awaiting.value = true;
  attemptsLeft = POLL_ATTEMPTS;
  pollTimer = setTimeout(pollOnce, POLL_INTERVAL_MS);
}

async function pollOnce() {
  pollTimer = null;
  if (attemptsLeft <= 0) return;
  attemptsLeft -= 1;
  const done = await runCheck();
  if (!done && attemptsLeft > 0) pollTimer = setTimeout(pollOnce, POLL_INTERVAL_MS);
}

async function checkNow() {
  stopPolling();
  await runCheck();
}

/** True once the domain verifies, or once retrying would be pointless. */
async function runCheck(): Promise<boolean> {
  checking.value = true;
  try {
    // A background check the user did not ask for: no app-wide spinner.
    const result = await domainStore.verifyDomain(props.domain.id, { silent: true });
    if (!result.ok) {
      error.value = result.message ?? t('common.states.error');
      return true;
    }
    if (result.data?.verified) {
      stopPolling();
      awaiting.value = false;
      notifications.show(t('domains.verified'), 'success');
      emit('verified');
      return true;
    }
    return false;
  } finally {
    checking.value = false;
  }
}
</script>

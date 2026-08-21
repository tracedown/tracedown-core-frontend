<template>
    <li>
      <div
        class="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-background-primary/30"
        @click="emit('toggle')"
      >
        <div class="min-w-0">
          <p class="text-sm text-text-primary font-mono truncate">
            {{ domain.domain }}
            <span
              v-if="domain.wildcardEnabled"
              class="text-text-secondary"
            >(*.{{ domain.domain }})</span>
          </p>
          <p class="text-xs text-text-secondary">
            {{ domain.verificationType }}
            <template v-if="domain.lastCheckedAt">
              · {{ t('domains.lastChecked') }}: {{ formatDate(domain.lastCheckedAt) }}
            </template>
          </p>
        </div>
        <BadgePill
          class="ml-auto shrink-0"
          :color-class="statusPill"
          :label="t(`domains.status.${effectiveStatus}`)"
        />
        <IconButton
          v-if="canManage"
          :fa-icon="faTrash"
          :title="t('common.actions.delete')"
          color-class="text-text-secondary hover:text-status-failure"
          icon-class="w-3.5 h-3.5"
          :hold-offset-sec="3"
          @safe-click="handleDelete"
        />
      </div>

      <div
        v-if="expanded"
        class="pb-4 space-y-3 max-w-2xl"
      >
        <DomainChallengeInfo :domain="domain" />

        <template v-if="canManage && effectiveStatus !== 'verified' && domain.verificationType === 'dns-01'">
          <!-- A host may replace this with something richer (its own provider
               integration); when it has, the built-in hand-off stands down
               rather than offering the same thing twice. -->
          <SlotOutlet
            name="domain-dns-setup"
            :slot-props="{ domain, onVerified: () => { verifyError = null; } }"
          />
          <DomainDnsHandoff
            v-if="!hostOwnsDnsSetup"
            :domain="domain"
            @verified="verifyError = null"
          />
        </template>

        <div class="flex items-center gap-3 flex-wrap">
          <PrimaryButton
            v-if="canManage && effectiveStatus !== 'verified'"
            :label-text="t('domains.verify')"
            :loading="verifying"
            :on-click="handleVerify"
          />
          <div
            v-if="canManage"
            class="flex items-center gap-2"
          >
            <ToggleSwitch
              :model-value="domain.wildcardEnabled"
              @update:model-value="(value: boolean) => handleWildcard(value)"
            />
            <span class="text-xs text-text-secondary">{{ t('domains.wildcard') }}</span>
          </div>
        </div>
        <p
          v-if="verifyError && !verifying"
          class="text-xs text-status-failure"
        >
          {{ verifyError }}
        </p>
      </div>
    </li>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import BadgePill from '@/components/core/BadgePill.vue';
import IconButton from '@/components/core/buttons/IconButton.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import ToggleSwitch from '@/components/core/input/ToggleSwitch.vue';
import SlotOutlet from '@/components/core/SlotOutlet.vue';
import DomainDnsHandoff from '@/components/settings/DomainDnsHandoff.vue';
import DomainChallengeInfo from '@/components/settings/DomainChallengeInfo.vue';
import { slotIsFilled } from '@/config/extensions';
import { useDomainStore } from '@/store/core/domain';
import { useNotificationStore } from '@/store/ui/notifications';
import type { DomainSummary } from '@/data/domains/DomainDto';

/**
 * One domain list row + its expandable verification block. Owns its own
 * verify state so a failure message only ever shows under the domain it
 * belongs to.
 */
const props = defineProps<{
  domain: DomainSummary;
  expanded: boolean;
  canManage: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();

const { t } = useI18n();
/** A host registered its own DNS setup surface, so ours steps aside. */
const hostOwnsDnsSetup = slotIsFilled('domain-dns-setup');
const domainStore = useDomainStore();
const notifications = useNotificationStore();

const verifying = ref<boolean>(false);
const verifyError = ref<string | null>(null);

const effectiveStatus = computed<string>(() => {
  if (props.domain.lapsed) return 'lapsed';
  return props.domain.status === 'verified' ? 'verified' : 'pending';
});

const statusPill = computed<string>(() => {
  if (effectiveStatus.value === 'verified') return 'bg-status-success/10 text-status-success';
  if (effectiveStatus.value === 'lapsed') return 'bg-status-failure/10 text-status-failure';
  return 'bg-status-warning/10 text-status-warning';
});

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

async function handleVerify() {
  verifying.value = true;
  verifyError.value = null;
  try {
    const result = await domainStore.verifyDomain(props.domain.id);
    if (!result.ok) {
      notifications.show(result.message ?? t('common.states.error'), 'error');
      return;
    }
    if (result.data?.verified) {
      notifications.show(t('domains.verified'), 'success');
    } else {
      verifyError.value = result.data?.error ?? t('domains.verifyFailed');
    }
  } finally {
    verifying.value = false;
  }
}

async function handleWildcard(value: boolean) {
  const result = await domainStore.setWildcard(props.domain.id, value);
  if (!result.ok && result.message) notifications.show(result.message, 'error');
}

async function handleDelete() {
  const result = await domainStore.deleteDomain(props.domain.id);
  if (!result.ok && result.message) notifications.show(result.message, 'error');
}
</script>

<template>
    <div class="px-gutter py-4 space-y-8">
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <SectionHeading :label="t('domains.title')" />
          <CreateToggleButton
            v-if="canManage"
            v-model="createOpen"
            :label-text="t('domains.add')"
          />
        </div>
        <p class="text-sm text-text-secondary max-w-2xl">
          {{ t('domains.pageHint') }}
        </p>

        <div
          v-if="createOpen"
          class="flex items-end gap-2 max-md:flex-col max-md:items-stretch"
        >
          <div>
            <p class="text-xs text-text-secondary mb-1">
              {{ t('domains.domain') }}
            </p>
            <TextInput
              v-model="newDomain"
              class="w-64"
              compact
              placeholder="company.com"
            />
          </div>
          <div>
            <p class="text-xs text-text-secondary mb-1">
              {{ t('domains.method') }}
            </p>
            <AppSelect
              v-model="newType"
              class="w-28"
              :options="TYPE_OPTIONS"
            />
          </div>
          <PrimaryButton
            :label-text="t('common.actions.add')"
            :loading="creating"
            :disabled="!domainValid"
            :on-click="handleCreate"
          />
        </div>

        <LoadingState v-if="domainStore.loading && domainStore.domains.length === 0" />
        <EmptyState
          v-else-if="domainStore.domains.length === 0"
          compact
          :message="t('domains.none')"
        />
        <ul
          v-else
          class="divide-y divide-text-secondary/15 max-w-3xl"
        >
          <DomainListRow
            v-for="domain in domainStore.domains"
            :key="domain.id"
            :domain="domain"
            :expanded="expandedId === domain.id"
            :can-manage="canManage"
            @toggle="expandedId = expandedId === domain.id ? null : domain.id"
          />
        </ul>
      </div>

      <p class="text-xs text-text-secondary max-w-2xl">
        {{ t('domains.limitsHint') }}
      </p>

      <ModalDialog
        v-if="justCreated"
        :modal-name="t('domains.createdTitle', { domain: justCreated.domain })"
        @close="justCreated = null"
      >
        <div class="space-y-3 max-w-lg">
          <DomainChallengeInfo :domain="justCreated" />
          <!-- The same hand-off the row offers: the moment right after adding a
               domain is when someone most wants it, not after hunting for the
               row and expanding it. -->
          <template v-if="justCreated.verificationType === 'dns-01'">
            <SlotOutlet
              name="domain-dns-setup"
              :slot-props="{ domain: justCreated }"
            />
            <DomainDnsHandoff
              v-if="!hostOwnsDnsSetup"
              :domain="justCreated"
            />
          </template>
          <p class="text-xs text-text-secondary">
            {{ t('domains.createdHint') }}
          </p>
        </div>
        <!--  Pinned above the fold on a phone, inline on desktop.  -->
        <template #footer>
          <PrimaryButton
            :label-text="t('common.actions.close')"
            :on-click="() => justCreated = null"
          />
        </template>
      </ModalDialog>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import SectionHeading from '@/components/core/SectionHeading.vue';
import LoadingState from '@/components/core/LoadingState.vue';
import EmptyState from '@/components/core/EmptyState.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import CreateToggleButton from '@/components/core/buttons/CreateToggleButton.vue';
import ModalDialog from '@/components/core/ModalDialog.vue';
import SlotOutlet from '@/components/core/SlotOutlet.vue';
import DomainDnsHandoff from '@/components/settings/DomainDnsHandoff.vue';
import DomainChallengeInfo from '@/components/settings/DomainChallengeInfo.vue';
import DomainListRow from '@/components/settings/DomainListRow.vue';
import TextInput from '@/components/core/input/TextInput.vue';
import AppSelect from '@/components/core/input/AppSelect.vue';
import { slotIsFilled } from '@/config/extensions';
import { useDomainStore } from '@/store/core/domain';
import { useAuthStore } from '@/store/core/auth';
import { useNotificationStore } from '@/store/ui/notifications';
import type { DomainSummary } from '@/data/domains/DomainDto';
import type { SelectOption } from '@/types/ui/common';

/**
 * Org-owned domains and their ownership verification (spec §18.4). Probes
 * against domains NOT verified here run restricted: max 3 calls per script,
 * no body saving, 5-minute minimum interval.
 */
const { t } = useI18n();
/** A host registered its own DNS setup surface, so ours steps aside. */
const hostOwnsDnsSetup = slotIsFilled('domain-dns-setup');
const domainStore = useDomainStore();
const authStore = useAuthStore();
const notifications = useNotificationStore();

const TYPE_OPTIONS: SelectOption[] = [
  { value: 'dns-01', label: 'DNS' },
  { value: 'http-01', label: 'HTTP' },
];

const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

const canManage = computed(() => authStore.canWrite('domains'));

const expandedId = ref<string | null>(null);
const createOpen = ref<boolean>(false);
const newDomain = ref<string>('');
const newType = ref<string>('dns-01');
const creating = ref<boolean>(false);
const justCreated = ref<DomainSummary | null>(null);

const domainValid = computed(() => DOMAIN_RE.test(newDomain.value.trim().toLowerCase()));

async function handleCreate() {
  if (creating.value) return;
  creating.value = true;
  try {
    const result = await domainStore.createDomain({
      domain: newDomain.value.trim().toLowerCase(),
      verificationType: newType.value,
    });
    if (!result.ok || !result.data) {
      notifications.show(result.message ?? t('common.states.error'), 'error');
      return;
    }
    newDomain.value = '';
    createOpen.value = false;
    justCreated.value = result.data;
  } finally {
    creating.value = false;
  }
}

onMounted(() => {
  void domainStore.fetchDomains();
});
</script>

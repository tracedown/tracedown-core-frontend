<template>
    <div class="space-y-3 max-w-xl">
      <template v-if="open">
        <p class="text-sm text-text-secondary">
          {{ t('agents.connectHint') }}
        </p>

        <div class="flex items-end gap-2 flex-wrap max-md:flex-col max-md:items-stretch">
          <div>
            <p class="text-xs text-text-secondary mb-1">
              {{ t('agents.slug') }}
            </p>
            <TextInput
              v-model="newSlug"
              class="w-48"
              :prefix="slugPrefix ? `${slugPrefix}-` : undefined"
              :placeholder="t('agents.slugPlaceholder')"
            />
          </div>
          <div>
            <p class="text-xs text-text-secondary mb-1">
              {{ t('agents.label') }}
            </p>
            <TextInput
              v-model="newLabel"
              class="w-48"
              :placeholder="t('agents.slug')"
            />
          </div>
          <div v-if="storesEnabled">
            <p class="text-xs text-text-secondary mb-1">
              {{ t('agents.storage.store') }}
            </p>
            <AppSelect
              v-model="storeChoice"
              class="w-48"
              :options="storeOptions"
            />
          </div>
          <PrimaryButton
            :label-text="t('agents.generateToken')"
            :loading="generating"
            :disabled="!slugValid || slugTaken"
            :on-click="handleGenerate"
          />
        </div>
        <p
          v-if="newSlug && !slugValid"
          class="text-xs text-status-warning"
        >
          {{ t('agents.slugInvalid') }}
        </p>
        <p
          v-else-if="slugTaken"
          class="text-xs text-status-warning"
        >
          {{ t('agents.slugTaken') }}
        </p>
      </template>

      <!-- Show-once token -->
      <AgentStartupInstructions
        v-if="issued"
        :issued="issued"
        :chosen-store="issuedStore"
        :stores-enabled="storesEnabled"
      />
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import AppSelect from '@/components/core/input/AppSelect.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import TextInput from '@/components/core/input/TextInput.vue';
import AgentStartupInstructions from '@/components/settings/AgentStartupInstructions.vue';
import { bodyStoreOptions, DEFAULT_OPTION } from '@/components/settings/bodyStores/bodyStoreOptions';
import { isFeatureEnabled } from '@/config/extensions';
import { useAgentStore } from '@/store/core/agent';
import { useBodyStoreStore } from '@/store/core/bodyStore';
import { useOrgStore } from '@/store/core/org';
import { useNotificationStore } from '@/store/ui/notifications';
import type { BootstrapTokenResponse } from '@/data/agents/AgentDto';
import type { BodyStoreRef } from '@/data/bodyStores/BodyStoreDto';

/**
 * "Connect a new agent" flow: slug/label (and, with body stores, the store the
 * agent writes response bodies to) → one-time bootstrap token → show-once
 * panel with the token and the full local startup command.
 * The open state is owned by the parent (toggle sits in the list header).
 *
 * `slugPrefix` (optional): a host that namespaces agent slugs renders the
 * namespace as the fixed head of the input — the user types only their part,
 * and the submitted slug is `"<prefix>-<typed>"`.
 */
const open = defineModel<boolean>('open', { required: true });
const props = defineProps<{
  slugPrefix?: string;
}>();
const { t } = useI18n();
const agentStore = useAgentStore();
const bodyStoreStore = useBodyStoreStore();
const orgStore = useOrgStore();
const notifications = useNotificationStore();

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

const newSlug = ref<string>('');
const newLabel = ref<string>('');
const generating = ref<boolean>(false);
const issued = ref<BootstrapTokenResponse | null>(null);

const storesEnabled = computed(() => isFeatureEnabled('bodyStores', { orgId: orgStore.selectedOrgId }));

/** The store the next token enrols its agent onto; `DEFAULT_OPTION` = the default store. */
const storeChoice = ref<string>(DEFAULT_OPTION);
/** The store the issued token was requested with, frozen at issue time. */
const issuedStore = ref<BodyStoreRef | null>(null);

const storeOptions = computed(() => bodyStoreOptions(bodyStoreStore.stores, t('agents.storage.defaultStore')));

/** The slug actually submitted — the typed value under the fixed prefix, if any. */
const fullSlug = computed(() => {
  const typed = newSlug.value.trim();
  return props.slugPrefix ? `${props.slugPrefix}-${typed}` : typed;
});

const slugValid = computed(() =>
  newSlug.value.trim().length > 0 && SLUG_RE.test(fullSlug.value));

/**
 * A token for a slug that is already an agent can never be redeemed —
 * registration refuses it — and the gateway refuses to issue one. Catching it
 * against the loaded fleet first saves the round trip; the server check still
 * covers an agent registered since the list was fetched.
 */
const slugTaken = computed(() =>
  agentStore.agents.some(agent => agent.slug === fullSlug.value));

async function handleGenerate() {
  if (generating.value) return;
  generating.value = true;
  try {
    const chosen = storesEnabled.value
      ? bodyStoreStore.stores.find(store => store.id === storeChoice.value) ?? null
      : null;
    const result = await agentStore.createBootstrapToken({
      slug: fullSlug.value,
      label: newLabel.value.trim() || undefined,
      bodyStoreId: chosen?.id,
    });
    if (!result.ok || !result.data) {
      notifications.show(result.message ?? t('common.states.error'), 'error');
      return;
    }
    issued.value = result.data;
    issuedStore.value = chosen;
    newSlug.value = '';
    newLabel.value = '';
  } finally {
    generating.value = false;
  }
}

// The form can be mounted on its own (a host's agents panel), so it loads the
// stores it offers rather than rely on the fleet view having done so.
onMounted(() => {
  if (!storesEnabled.value) return;
  if (bodyStoreStore.stores.length === 0 && !bodyStoreStore.loading) void bodyStoreStore.fetchStores();
  if (!bodyStoreStore.defaultStore) void bodyStoreStore.fetchDefault();
});
</script>

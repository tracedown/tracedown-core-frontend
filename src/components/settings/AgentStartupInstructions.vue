<template>
    <div class="rounded-lg border border-status-warning/40 bg-status-warning/5 p-4 space-y-2">
      <p class="text-sm text-text-primary">
        {{ t('agents.tokenIssued', { slug: issued.slug }) }}
      </p>
      <CopyField :value="issued.token" />
      <p class="text-xs text-text-secondary">
        {{ t('agents.tokenInstructions') }}
      </p>

      <p class="text-sm text-text-primary pt-1">
        {{ t('agents.startCommand') }}
      </p>

      <!-- With body stores the agent's store was chosen before the token was
           issued and the command follows it. Without, where the agent keeps
           response bodies only switches templates: bucket settings are
           placeholders the operator fills in where the agent starts. -->
      <p
        v-if="storesEnabled"
        class="text-xs text-text-secondary"
      >
        {{ t('agents.storage.store') }}:
        <span class="text-text-primary">{{ store ? store.name : defaultLabel }}</span>
      </p>
      <div
        v-else
        class="flex items-end gap-2 flex-wrap max-md:flex-col max-md:items-stretch"
      >
        <div>
          <p class="text-xs text-text-secondary mb-1">
            {{ t('agents.storage.label') }}
          </p>
          <AppSelect
            v-model="storage"
            class="w-52"
            :options="storageOptions"
          />
        </div>
      </div>
      <p
        v-if="storageNote"
        class="text-xs text-text-secondary"
      >
        {{ storageNote }}
      </p>

      <!-- One bootstrap, two ways to hand it to the agent: the container
           command, or the bare variables for an agent started by systemd, a
           VM image or a pip install. -->
      <TabBar
        v-model="startMode"
        variant="pills"
        :tabs="startModeTabs"
      />
      <CopyField
        :value="startMode === 'docker' ? startCommand : startEnvironment"
        multiline
      />
      <template v-if="startMode === 'docker'">
        <p class="text-xs text-text-secondary">
          {{ t('agents.startCommandHint') }}
        </p>
        <p class="text-xs text-text-secondary">
          {{ t('agents.startCommandImageNote', { image: AGENT_IMAGE }) }}
        </p>
      </template>
      <p
        v-else
        class="text-xs text-text-secondary"
      >
        {{ t('agents.startEnvironmentHint', { slug: issued.slug }) }}
      </p>
      <p
        v-if="!issued.schedulerUrl"
        class="text-xs text-status-warning"
      >
        {{ t('agents.schedulerUrlUnset', { url: COMPOSE_SCHEDULER_URL }) }}
      </p>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import CopyField from '@/components/common/CopyField.vue';
import TabBar from '@/components/core/TabBar.vue';
import AppSelect from '@/components/core/input/AppSelect.vue';
import { useBodyStoreStore } from '@/store/core/bodyStore';
import {
  AGENT_IMAGE,
  COMPOSE_SCHEDULER_URL,
  agentBodyTarget,
  agentDockerCommand,
  agentEnvFile,
} from '@/lib/agentStartup';
import type { AgentStartupInput } from '@/lib/agentStartup';
import type { BootstrapTokenResponse } from '@/data/agents/AgentDto';
import type { BodyStoreRef } from '@/data/bodyStores/BodyStoreDto';
import type { DisplayTab } from '@/types/ui/tabs';
import type { SelectOption } from '@/types/ui/common';

/**
 * The show-once panel after a bootstrap token is issued: the token, and the
 * command / environment that start an agent with it.
 */
const props = defineProps<{
  issued: BootstrapTokenResponse;
  /** The store picked in the form when the token was requested (null = default). */
  chosenStore: BodyStoreRef | null;
  /** Whether body stores are available; off, the old filesystem / S3 choice is offered. */
  storesEnabled: boolean;
}>();

const { t } = useI18n();
const bodyStoreStore = useBodyStoreStore();

const defaultLabel = computed(() => t('agents.storage.defaultStore'));

/**
 * The store the agent was enrolled onto. The token response says so
 * authoritatively; the form's own pick covers a gateway that does not echo it.
 */
const store = computed<BodyStoreRef | null>(() =>
  (props.issued.bodyStore !== undefined ? props.issued.bodyStore : props.chosenStore));

/** Which rendering of the same bootstrap is on screen. */
const startMode = ref<string>('docker');

const startModeTabs = computed<DisplayTab[]>(() => [
  { key: 'docker', label: t('agents.startModeDocker') },
  { key: 'environment', label: t('agents.startModeEnvironment') },
]);

/** Without body stores: where the agent keeps response bodies — picks the template. */
const storage = ref<string>('filesystem');

const storageOptions = computed<SelectOption[]>(() => [
  { value: 'filesystem', label: t('agents.storage.filesystem') },
  { value: 's3', label: t('agents.storage.s3') },
]);

const bodies = computed(() => {
  if (!props.storesEnabled) return agentBodyTarget(null, storage.value === 's3' ? 's3' : 'filesystem');
  return agentBodyTarget(store.value, bodyStoreStore.defaultStore?.kind === 's3' ? 's3' : 'filesystem');
});

const storageNote = computed<string | null>(() => {
  const target = bodies.value;
  if (target.backend === 's3') return target.store ? t('agents.storage.storeS3Note') : t('agents.storage.s3Note');
  if (props.storesEnabled && store.value) return t('agents.storage.storeFilesystemNote', { path: target.dir });
  return null;
});

/**
 * Everything the two renderings are generated from. The enrolment address
 * comes from the gateway with the token — it is the one thing the browser
 * cannot know, and `null` (nothing configured) is answered with the shipped
 * stack's internal address plus a warning, not a silent guess.
 */
const startup = computed<AgentStartupInput>(() => ({
  slug: props.issued.slug,
  token: props.issued.token,
  schedulerUrl: props.issued.schedulerUrl ?? null,
  bodies: bodies.value,
}));

const startCommand = computed(() => agentDockerCommand(startup.value));
const startEnvironment = computed(() => agentEnvFile(startup.value));
</script>

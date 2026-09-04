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
      <div
        v-if="issued"
        class="rounded-lg border border-status-warning/40 bg-status-warning/5 p-4 space-y-2"
      >
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

        <!-- Where the agent keeps response bodies decides which variables the
             command carries and whether it mounts a volume. The choice only
             switches templates: bucket settings are placeholders the operator
             fills in where the agent starts, never typed here. -->
        <div class="flex items-end gap-2 flex-wrap max-md:flex-col max-md:items-stretch">
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
          v-if="storage === 's3'"
          class="text-xs text-text-secondary"
        >
          {{ t('agents.storage.s3Note') }}
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
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import CopyField from '@/components/common/CopyField.vue';
import TabBar from '@/components/core/TabBar.vue';
import AppSelect from '@/components/core/input/AppSelect.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import TextInput from '@/components/core/input/TextInput.vue';
import { useAgentStore } from '@/store/core/agent';
import { useNotificationStore } from '@/store/ui/notifications';
import type { BootstrapTokenResponse } from '@/data/agents/AgentDto';
import type { DisplayTab } from '@/types/ui/tabs';
import type { SelectOption } from '@/types/ui/common';
import {
  AGENT_IMAGE,
  COMPOSE_SCHEDULER_URL,
  agentDockerCommand,
  agentEnvFile,
} from '@/lib/agentStartup';
import type { AgentStartupInput } from '@/lib/agentStartup';

/**
 * "Connect a new agent" flow: slug/label → one-time bootstrap token →
 * show-once panel with the token and the full local startup command.
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
const notifications = useNotificationStore();

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

const newSlug = ref<string>('');
const newLabel = ref<string>('');
const generating = ref<boolean>(false);
const issued = ref<BootstrapTokenResponse | null>(null);

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

/** Which rendering of the same bootstrap is on screen. */
const startMode = ref<string>('docker');

const startModeTabs = computed<DisplayTab[]>(() => [
  { key: 'docker', label: t('agents.startModeDocker') },
  { key: 'environment', label: t('agents.startModeEnvironment') },
]);

/** Where the agent keeps response bodies — picks the template. */
const storage = ref<string>('filesystem');

const storageOptions = computed<SelectOption[]>(() => [
  { value: 'filesystem', label: t('agents.storage.filesystem') },
  { value: 's3', label: t('agents.storage.s3') },
]);

/**
 * Everything the two renderings are generated from. The enrolment address
 * comes from the gateway with the token — it is the one thing the browser
 * cannot know, and `null` (nothing configured) is answered with the shipped
 * stack's internal address plus a warning, not a silent guess.
 */
const startup = computed<AgentStartupInput | null>(() => {
  if (!issued.value) return null;
  return {
    slug: issued.value.slug,
    token: issued.value.token,
    schedulerUrl: issued.value.schedulerUrl ?? null,
    storage: storage.value === 's3' ? 's3' : 'filesystem',
  };
});

const startCommand = computed(() => (startup.value ? agentDockerCommand(startup.value) : ''));
const startEnvironment = computed(() => (startup.value ? agentEnvFile(startup.value) : ''));

async function handleGenerate() {
  if (generating.value) return;
  generating.value = true;
  try {
    const result = await agentStore.createBootstrapToken({
      slug: fullSlug.value,
      label: newLabel.value.trim() || undefined,
    });
    if (!result.ok || !result.data) {
      notifications.show(result.message ?? t('common.states.error'), 'error');
      return;
    }
    issued.value = result.data;
    newSlug.value = '';
    newLabel.value = '';
  } finally {
    generating.value = false;
  }
}
</script>

<template>
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <SectionHeading :label="t('grafana.title')" />
        <!--  The title rides the wrapper, not the button: a disabled button is
              inert and a native tooltip on it never opens.  -->
        <span
          v-if="canEdit && !loading && !integration"
          class="inline-block"
          :title="createGate.hint || undefined"
        >
          <PrimaryButton
            :label-text="t('grafana.connect')"
            :loading="creating"
            :disabled="!createGate.enabled"
            :on-click="handleCreate"
          />
        </span>
      </div>
      <p class="text-sm text-text-secondary max-w-2xl">
        {{ t('grafana.hint') }}
      </p>

      <LoadingState v-if="loading" />
      <template v-else-if="integration">
        <div class="flex items-center gap-3">
          <ToggleSwitch
            v-if="canEdit"
            :model-value="integration.enabled"
            @update:model-value="handleToggle"
          />
          <BadgePill
            :color-class="integration.enabled
              ? 'bg-status-success/10 text-status-success'
              : 'bg-status-warning/10 text-status-warning'"
            :label="integration.enabled ? t('grafana.enabled') : t('grafana.paused')"
          />
          <div
            v-if="canEdit"
            class="ml-auto flex items-center gap-1 shrink-0"
          >
            <SecondaryButton
              :label-text="t('grafana.regenerate')"
              :fa-icon="faRotate"
              :on-click="handleRegenerate"
            />
            <IconButton
              :fa-icon="faTrash"
              :title="t('common.actions.delete')"
              color-class="text-text-secondary hover:text-status-failure"
              :hold-offset-sec="3"
              @safe-click="handleDelete"
            />
          </div>
        </div>

        <CopyField
          :label="t('grafana.scrapeUrl')"
          :value="scrapeTarget"
        />

        <div
          v-if="issuedToken"
          class="rounded-lg border border-status-warning/40 bg-status-warning/5 p-4 space-y-2"
        >
          <p class="text-sm text-text-primary">
            {{ t('grafana.issued') }}
          </p>
          <CopyField :value="issuedToken" />
          <p class="text-xs text-text-secondary">
            {{ t('grafana.issuedHint') }}
          </p>
        </div>

        <div v-if="canEdit">
          <p class="text-xs text-text-secondary mb-1">
            {{ t('grafana.scope') }}
          </p>
          <AppSelect
            v-model="scopeIds"
            class="w-72"
            multiple
            searchable
            :options="serviceOptions"
            :placeholder="t('grafana.allServices')"
          />
        </div>
      </template>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { faRotate, faTrash } from '@fortawesome/free-solid-svg-icons';
import CopyField from '@/components/common/CopyField.vue';
import SectionHeading from '@/components/core/SectionHeading.vue';
import LoadingState from '@/components/core/LoadingState.vue';
import BadgePill from '@/components/core/BadgePill.vue';
import IconButton from '@/components/core/buttons/IconButton.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import SecondaryButton from '@/components/core/buttons/SecondaryButton.vue';
import ToggleSwitch from '@/components/core/input/ToggleSwitch.vue';
import AppSelect from '@/components/core/input/AppSelect.vue';
import { useGrafanaIntegrationStore } from '@/store/core/grafanaIntegration';
import { useNotificationStore } from '@/store/ui/notifications';
import { useFeatureGate } from '@/composables/useFeatureGate';
import type { GrafanaIntegrationSummary } from '@/data/integrations/GrafanaDto';
import type { SelectOption } from '@/types/ui/common';

/**
 * Project Grafana integration (spec §13): a Prometheus scrape endpoint for
 * the project's probe metrics, guarded by a show-once bearer token. Scope
 * defaults to every service in the project; picking services narrows it.
 */
const props = defineProps<{
  projectId: string;
  canEdit: boolean;
}>();

const { t } = useI18n();
const grafanaStore = useGrafanaIntegrationStore();
const notifications = useNotificationStore();
const createGate = useFeatureGate('grafanaIntegration.create');

const loading = ref<boolean>(true);
const creating = ref<boolean>(false);
const integration = ref<GrafanaIntegrationSummary | null>(null);
const issuedToken = ref<string | null>(null);
const serviceOptions = ref<SelectOption[]>([]);
const scopeIds = ref<string[]>([]);

/** Explicit platform override, else the app origin (nginx proxies /metrics/). */
const scrapeTarget = computed(() => {
  if (!integration.value) return '';
  return integration.value.scrapeUrl ?? `${window.location.origin}${integration.value.scrapePath}`;
});

function currentScopeIds(value: GrafanaIntegrationSummary | null): string[] {
  return value?.scope?.type === 'services' ? [...(value.scope.ids ?? [])] : [];
}

function applyIntegration(value: GrafanaIntegrationSummary | null) {
  integration.value = value;
  scopeIds.value = currentScopeIds(value);
}

async function handleCreate() {
  if (creating.value) return;
  creating.value = true;
  try {
    const result = await grafanaStore.createIntegration(props.projectId);
    if (!result.ok || !result.data) {
      notifications.show(result.message ?? t('common.states.error'), 'error');
      return;
    }
    issuedToken.value = result.data.token ?? null;
    applyIntegration(result.data);
  } finally {
    creating.value = false;
  }
}

async function handleToggle(enabled: boolean) {
  const result = await grafanaStore.updateIntegration(props.projectId, { enabled });
  if (!result.ok || !result.data) {
    notifications.show(result.message ?? t('common.states.error'), 'error');
    return;
  }
  applyIntegration(result.data);
}

async function handleRegenerate() {
  const result = await grafanaStore.regenerateToken(props.projectId);
  if (!result.ok || !result.data) {
    notifications.show(result.message ?? t('common.states.error'), 'error');
    return;
  }
  issuedToken.value = result.data.token ?? null;
  applyIntegration(result.data);
}

async function handleDelete() {
  const result = await grafanaStore.deleteIntegration(props.projectId);
  if (!result.ok) {
    if (result.message) notifications.show(result.message, 'error');
    return;
  }
  issuedToken.value = null;
  applyIntegration(null);
}

watch(scopeIds, async (ids) => {
  if (!integration.value) return;
  const persisted = currentScopeIds(integration.value);
  if (ids.length === persisted.length && ids.every(id => persisted.includes(id))) return;
  const scope = ids.length > 0 ? { type: 'services', ids } : { type: 'all' };
  const result = await grafanaStore.updateIntegration(props.projectId, { scope });
  if (!result.ok || !result.data) {
    notifications.show(result.message ?? t('common.states.error'), 'error');
    return;
  }
  applyIntegration(result.data);
});

onMounted(async () => {
  const [integrationResult, servicesResult] = await Promise.all([
    grafanaStore.fetchIntegration(props.projectId),
    grafanaStore.fetchServiceOptions(props.projectId),
  ]);
  if (integrationResult.ok) applyIntegration(integrationResult.data ?? null);
  serviceOptions.value = (servicesResult.data ?? []).map(s => ({ value: s.id, label: s.name }));
  loading.value = false;
});
</script>

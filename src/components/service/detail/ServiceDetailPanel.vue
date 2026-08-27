<template>
    <!-- Surface color comes from the shared tab-content background. -->
    <div class="h-full">
      <ServiceDetailHeader
        :service="service"
        :can-edit="canEdit"
        :editing="editing"
        @edit="editing = true"
        @close="emit('close')"
      />

      <TabBar
        v-model="activeTab"
        :tabs="tabs"
      />

      <div class="px-gutter py-4">
        <template v-if="activeTab === 'config'">
          <ServiceEditForm
            v-if="editing"
            :service="service"
            :saving="saving"
            @save="handleSave"
            @cancel="editing = false"
            @delete="handleDelete"
          />
          <ServiceConfigTab
            v-else
            :service="service"
            :can-edit="canEdit"
            :recent-probes="recentProbes"
            @edit="editing = true"
          />
        </template>

        <VariablesTab
          v-if="activeTab === 'variables'"
          resource-type="services"
          :resource-id="service.id"
          :can-edit="canEdit"
        />

        <ServiceResultsTab
          v-if="activeTab === 'results'"
          :service="service"
          :live-tick="liveTick"
        />

        <ServiceStatisticsTab
          v-if="activeTab === 'statistics'"
          :service="service"
        />

        <ResourceAccessTab
          v-if="activeTab === 'access'"
          resource-type="service"
          :resource-id="service.id"
        />

        <UsageTab
          v-if="activeTab === 'usage'"
          scope="services"
          :resource-id="service.id"
        />
      </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { faChartArea, faChartLine, faKey, faListCheck, faSliders, faUsers } from '@fortawesome/free-solid-svg-icons';
import TabBar from '@/components/core/TabBar.vue';
import VariablesTab from '@/components/resource/variables/VariablesTab.vue';
import ServiceDetailHeader from '@/components/service/detail/ServiceDetailHeader.vue';
import ServiceConfigTab from '@/components/service/detail/ServiceConfigTab.vue';
import ServiceEditForm from '@/components/service/detail/ServiceEditForm.vue';
import ServiceResultsTab from '@/components/service/results/ServiceResultsTab.vue';
import ServiceStatisticsTab from '@/components/service/detail/ServiceStatisticsTab.vue';
import { useServiceLiveSnapshot } from '@/composables/useServiceLiveSnapshot';
import { useServiceStore } from '@/store/core/service';
import { useResultStore } from '@/store/core/result';
import { useNotificationStore } from '@/store/ui/notifications';
import type { ServiceSummary } from '@/data/services/ServiceDto';
import type { ServiceEditPayload } from '@/types/services';
import type { DisplayTab } from '@/types/ui/tabs';
import ResourceAccessTab from '@/components/resource/access/ResourceAccessTab.vue';
import UsageTab from '@/components/resource/usage/UsageTab.vue';

/** Details of the selected service. Remounted per service (`:key` upstream). */
const props = defineProps<{
  service: ServiceSummary;
  canEdit: boolean;
  initialEditing?: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();
const serviceStore = useServiceStore();
const resultStore = useResultStore();
const notifications = useNotificationStore();

const activeTab = ref<string>('config');
const editing = ref<boolean>(props.initialEditing ?? false);
const saving = ref<boolean>(false);

const { liveTick, recentProbes } = useServiceLiveSnapshot(() => props.service.id);

const tabs = computed<DisplayTab[]>(() => [
  { key: 'config', label: t('service.config'), icon: faSliders },
  { key: 'variables', label: t('common.labels.variables'), icon: faKey },
  { key: 'results', label: t('results.title'), icon: faListCheck, visible: !!props.service.metrics },
  { key: 'statistics', label: t('service.statistics'), icon: faChartLine, visible: !!props.service.metrics },
  { key: 'access', label: t('nav.users'), icon: faUsers, visible: props.canEdit },
  { key: 'usage', label: t('usage.title'), icon: faChartArea, visible: props.canEdit },
]);

async function handleDelete() {
  const result = await serviceStore.deleteService(props.service.id);
  if (!result.ok) {
    if (result.message) notifications.show(result.message, 'error');
    return;
  }
  notifications.show(t('service.deleted'), 'success');
  emit('close');
}

/**
 * Saves config and script together, version-checked, in one request.
 *
 * It used to be two — config, then script — and a save that lost a race
 * committed the config before the script came back 409, leaving the service
 * with this editor's schedule and someone else's script. One request means the
 * backend either takes both or takes neither.
 *
 * A rejected save leaves the form open with the draft intact, which is the only
 * remaining copy of the user's work: nothing here discards it, and on a version
 * conflict the notification tells them to reload and reapply.
 */
async function handleSave(payload: ServiceEditPayload) {
  if (Object.keys(payload.config).length === 0 && payload.script === null) {
    editing.value = false;
    return;
  }
  saving.value = true;
  try {
    const result = await serviceStore.saveService(props.service.id, payload, props.service.version);
    if (!result.ok) {
      if (result.message) notifications.show(result.message, 'error');
      return;
    }
    editing.value = false;
  } finally {
    saving.value = false;
  }
}

onUnmounted(() => {
  resultStore.clear();
});
</script>

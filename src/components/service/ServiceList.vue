<template>
    <!-- Surface color comes from the shared tab-content background. -->
    <div>
      <div class="flex items-center justify-between px-4 py-3 border-b border-text-secondary/50">
        <h2 class="text-sm font-semibold text-text-primary">
          {{ t('common.entities.services') }}
        </h2>
        <CreateToggleButton
          v-if="canEdit"
          v-model="showCreateForm"
          :label-text="t('service.createNew')"
          :disabled="!isFeatureEnabled('service.create')"
          :hint="t('common.actionUnavailable')"
        />
      </div>

      <div
        v-if="showCreateForm"
        class="px-4 pt-4"
      >
        <InlineCreateForm
          :title="t('service.createTitle')"
          :placeholder="t('service.namePlaceholder')"
          @create="handleCreate"
        />
      </div>

      <LoadingState v-if="serviceStore.loading" />

      <EmptyState
        v-else-if="serviceStore.totalResults === 0"
        :icon="faFolderOpen"
        :message="t('service.noServices')"
        :description="t('service.noServicesDescription')"
      />

      <template v-else>
        <ServiceListSection
          v-for="category in SERVICE_CATEGORIES"
          v-show="serviceStore.categories[category].total > 0"
          :key="category"
          :label="t(SECTION_META[category].labelKey)"
          :count="serviceStore.categories[category].total"
          :color-class="SECTION_META[category].colorClass"
          :pill-class="SECTION_META[category].pillClass"
          :collapsed="collapsed[category] === true"
          @toggle="collapsed[category] = !collapsed[category]"
        >
          <ServiceListItem
            v-for="service in serviceStore.categories[category].items"
            :key="service.id"
            :service="service"
            :selected="service.id === selectedId"
            @select="emit('select', service.id)"
          />
        </ServiceListSection>
      </template>
    </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { isFeatureEnabled } from '@/config/extensions';
import { faFolderOpen } from '@fortawesome/free-solid-svg-icons';
import CreateToggleButton from '@/components/core/buttons/CreateToggleButton.vue';
import EmptyState from '@/components/core/EmptyState.vue';
import InlineCreateForm from '@/components/resource/InlineCreateForm.vue';
import ServiceListSection from '@/components/service/ServiceListSection.vue';
import ServiceListItem from '@/components/service/ServiceListItem.vue';
import { useServiceStore } from '@/store/core/service';
import { useNotificationStore } from '@/store/ui/notifications';
import { SERVICE_CATEGORIES } from '@/utils/serviceCategories';
import type { ServiceCategory } from '@/types/services';
import LoadingState from '@/components/core/LoadingState.vue';

const props = defineProps<{
  projectId: string;
  selectedId: string | null;
  canEdit: boolean;
}>();

const emit = defineEmits<{
  select: [serviceId: string];
  created: [serviceId: string];
}>();

const { t } = useI18n();
const serviceStore = useServiceStore();
const notifications = useNotificationStore();

const showCreateForm = ref<boolean>(false);
const collapsed = reactive<Partial<Record<ServiceCategory, boolean>>>({});

const SECTION_META: Record<ServiceCategory, { labelKey: string; colorClass: string; pillClass: string }> = {
  new: { labelKey: 'service.newSection', colorClass: 'text-text-secondary', pillClass: 'bg-text-secondary/10' },
  failed: { labelKey: 'service.failedSection', colorClass: 'text-status-failure', pillClass: 'bg-status-failure/10' },
  healthy: { labelKey: 'service.healthySection', colorClass: 'text-status-success', pillClass: 'bg-status-success/10' },
};

async function handleCreate(name: string) {
  const result = await serviceStore.createService({ projectId: props.projectId, name });
  if (!result.ok || !result.data) {
    if (result.message) notifications.show(result.message, 'error');
    return;
  }
  showCreateForm.value = false;
  emit('created', result.data.id);
}
</script>

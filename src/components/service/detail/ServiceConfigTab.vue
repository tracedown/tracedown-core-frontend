<template>
    <div>
      <!-- Probe mode / queue policy -->
      <div class="grid grid-cols-2 max-md:grid-cols-1 gap-2 text-xs mb-3">
        <div v-if="isFeatureEnabled('agents')">
          <div class="flex items-center gap-1">
            <span class="text-text-secondary">{{ t('service.probeMode') }}</span>
            <HelpTooltip :entries="probeModeHelp" />
          </div>
          <p class="text-text-primary mt-0.5">
            {{ service.probeMode }}
          </p>
        </div>
        <div>
          <div class="flex items-center gap-1">
            <span class="text-text-secondary">{{ t('service.queuePolicy') }}</span>
            <HelpTooltip :entries="queuePolicyHelp" />
          </div>
          <p class="text-text-primary mt-0.5">
            {{ service.queuePolicy }}
          </p>
        </div>
        <div>
          <span class="text-text-secondary">{{ t('service.saveResponseBodies') }}</span>
          <p class="text-text-primary mt-0.5">
            {{ service.saveResponseBodies ? t('service.saveResponseBodiesOn') : t('service.saveResponseBodiesOff') }}
          </p>
        </div>
        <div>
          <span class="text-text-secondary">{{ t('service.window') }}</span>
          <p
            class="mt-0.5"
            :class="windowLabelClass"
          >
            {{ windowLabel }}
          </p>
        </div>
      </div>

      <ServiceMetricsSummary
        :service="service"
        :recent-probes="recentProbes"
        class="mb-4"
      />

      <!-- Script viewer -->
      <div
        v-if="service.script"
        class="mb-4 max-md:max-h-none max-h-72 overflow-hidden"
      >
        <ScriptEditorField
          :model-value="service.script"
          :title="t('editor.scriptTitle', { name: service.name })"
          readonly
          min-height="3rem"
          max-height="18rem"
          :service-name="service.name"
        />
      </div>

      <div
        v-else
        class="text-center py-6"
      >
        <p class="text-text-secondary text-xs mb-3">
          {{ t('service.scriptEmpty') }}
        </p>
        <div
          v-if="canEdit"
          class="flex justify-center"
        >
          <PrimaryButton
            :label-text="t('service.editScript')"
            :fa-icon="faPenToSquare"
            :on-click="() => emit('edit')"
          />
        </div>
      </div>

      <p
        v-if="service.script && !service.metrics"
        class="text-xs text-text-secondary italic text-right"
      >
        {{ t('results.notRunYet') }}
      </p>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { faPenToSquare } from '@fortawesome/free-solid-svg-icons';
import HelpTooltip from '@/components/core/HelpTooltip.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import ScriptEditorField from '@/components/core/editor/ScriptEditorField.vue';
import ServiceMetricsSummary from '@/components/service/detail/ServiceMetricsSummary.vue';
import { isFeatureEnabled } from '@/config/extensions';
import { useAuthStore } from '@/store/core/auth';
import { useServiceHelp } from '@/composables/useServiceHelp';
import { formatWindowTime, parseServiceWindowRule } from '@/lib/serviceWindow';
import type { ProbePoint, ServiceSummary } from '@/data/services/ServiceDto';

const props = defineProps<{
  service: ServiceSummary;
  canEdit: boolean;
  recentProbes: ProbePoint[];
}>();

const emit = defineEmits<{
  edit: [];
}>();

const { t } = useI18n();
const authStore = useAuthStore();

const { probeModeHelp, queuePolicyHelp } = useServiceHelp();

/** Humanized window ("Daily 02:00–05:00 UTC"); custom API rules show raw. */
const windowLabel = computed(() => {
  if (!props.service.serviceWindow) return t('service.windowNone');
  const config = parseServiceWindowRule(props.service.serviceWindow);
  if (!config) return props.service.serviceWindow;
  const range = `${formatWindowTime(config.start)}\u2013${formatWindowTime(config.end)}`;
  const tz = config.timezone ?? authStore.orgDefaultTimezone;
  return config.frequency === 'daily'
    ? t('service.windowDailyLabel', { range, tz })
    : t('service.windowWeeklyLabel', {
      days: config.days.map(day => t(`service.days.${day}`)).join(', '),
      range,
      tz,
    });
});

const windowLabelClass = computed(() => {
  if (!props.service.serviceWindow) return 'text-text-secondary italic';
  return parseServiceWindowRule(props.service.serviceWindow)
    ? 'text-text-primary'
    : 'text-text-primary font-mono';
});
</script>

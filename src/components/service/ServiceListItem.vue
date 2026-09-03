<template>
    <div
      class="w-full text-left px-4 py-3 border-b border-text-secondary/25 border-l-2 transition-colors cursor-pointer"
      :class="selected
        ? 'bg-accent-primary/10 border-l-accent-primary'
        : 'border-l-transparent hover:bg-background-secondary/60'"
      @click="emit('select')"
    >
      <div class="flex items-center gap-2">
        <span
          class="w-2 h-2 rounded-full shrink-0"
          :class="statusDotClass(service.lastStatus)"
        />
        <span class="text-sm font-medium text-text-primary truncate">{{ service.name }}</span>
        <SilenceBell
          resource-type="service"
          :resource-id="service.id"
          :parent-keys="serviceParentKeys"
        />
        <BadgePill
          v-if="!service.isActive"
          class="shrink-0"
          color-class="bg-status-warning/15 text-status-warning"
          :label="t('common.states.inactive')"
        />
        <span
          class="ml-auto text-xs font-medium shrink-0"
          :style="metricsSuccessStyle(service.metrics)"
        >
          {{ successRate }}
        </span>
      </div>
      <div class="flex items-center gap-1.5 mt-1 pl-4 text-xs text-text-secondary max-md:flex-wrap">
        <FontAwesomeIcon :icon="faClock" class="w-3 h-3" />
        <span>{{ service.schedule }}</span>
        <span
          v-if="statusSince"
          class="ml-auto"
        >{{ statusSince }}</span>
      </div>
      <p
        v-if="failurePreview"
        class="mt-1 pl-4 text-xs text-status-failure truncate"
      >
        {{ failurePreview }}
      </p>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faClock } from '@fortawesome/free-solid-svg-icons';
import { computeSuccessRate, metricsSuccessStyle, statusDotClass } from '@/lib/metrics-utils';
import { useRelativeTime } from '@/composables/useRelativeTime';
import { useProjectStore } from '@/store/core/project';
import type { ServiceSummary } from '@/data/services/ServiceDto';
import BadgePill from '@/components/core/BadgePill.vue';
import SilenceBell from '@/components/core/notifications/SilenceBell.vue';

const props = defineProps<{
  service: ServiceSummary;
  selected: boolean;
}>();

const emit = defineEmits<{
  select: [];
}>();

const { t } = useI18n();
const projectStore = useProjectStore();

/** Ancestor keys for grant checks; the owning project is in the store. */
const serviceParentKeys = computed(() => {
  const project = projectStore.projects.find(p => p.id === props.service.projectId);
  return [
    `project::${props.service.projectId}`,
    ...(project ? [`workspace::${project.workspaceId}`] : []),
  ];
});
const { formatDuration, formatLastOnline } = useRelativeTime();

const successRate = computed(() => {
  const rate = computeSuccessRate(props.service.metrics);
  return rate == null ? '' : `${rate.toFixed(1)}%`;
});

/**
 * "Up for: duration" while healthy, "Last online: time" while failing —
 * but only when the service HAS been online: a service that has never
 * succeeded shows nothing (its failure-start time is not a last-online).
 */
const statusSince = computed(() => {
  const { lastStatus, lastStatusSince, metrics } = props.service;
  if (!lastStatus) return null;
  if (lastStatus === 'success') {
    return lastStatusSince ? `${t('service.upFor')}: ${formatDuration(lastStatusSince)}` : null;
  }
  const wasEverOnline = (metrics?.counters.probesSuccess ?? 0) > 0;
  if (!wasEverOnline || !lastStatusSince) return null;
  return `${t('service.lastOnline')}: ${formatLastOnline(lastStatusSince)}`;
});

/** Compact preview of the failed assertions. */
const failurePreview = computed(() => {
  const failure = props.service.lastFailure;
  if (!failure || failure.assertions.length === 0) return null;
  const parts = failure.assertions.slice(0, 2).map(a => {
    const prefix = a.expected ? `${t('results.expected')} ${a.expected}, ` : '';
    return `${a.scope}: ${prefix}${t('results.got')} ${a.actual ?? '?'}`;
  });
  const extra = failure.assertions.length > 2 ? ` +${failure.assertions.length - 2}` : '';
  return parts.join('; ') + extra;
});
</script>

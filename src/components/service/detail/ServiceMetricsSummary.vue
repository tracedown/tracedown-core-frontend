<template>
    <div class="text-xs space-y-3">
      <div class="grid grid-cols-4 gap-3 max-md:grid-cols-2">
        <div>
          <span class="text-text-secondary">{{ t('metrics.totalProbes') }}</span>
          <p class="text-text-primary font-medium mt-0.5">
            {{ totalProbes }}
          </p>
        </div>
        <div>
          <span class="text-text-secondary">{{ t('metrics.successRate') }}</span>
          <p
            class="font-medium mt-0.5"
            :style="metricsSuccessStyle(service.metrics)"
          >
            {{ successRate }}
          </p>
        </div>
        <div>
          <span class="text-text-secondary">{{ t('metrics.avgResponse') }}</span>
          <p class="text-text-primary font-medium mt-0.5">
            {{ avgResponse }}
          </p>
        </div>
        <div>
          <span class="text-text-secondary">{{ t('metrics.lastStatus') }}</span>
          <p
            class="font-medium mt-0.5"
            :class="statusTextClass(service.metrics?.state.lastStatus)"
          >
            {{ service.metrics?.state.lastStatus ?? '-' }}
          </p>
        </div>
      </div>

      <!-- Response time percentiles -->
      <div
        v-if="service.metrics?.percentiles"
        class="bg-background-primary p-3"
      >
        <p class="text-text-secondary font-medium mb-2">
          {{ t('metrics.responsePercentiles') }}
        </p>
        <div class="grid grid-cols-3 gap-3">
          <div
            v-for="(value, key) in service.metrics.percentiles"
            :key="key"
          >
            <span class="text-text-secondary">{{ key }}</span>
            <p class="text-text-primary font-mono mt-0.5">
              {{ value }}ms
            </p>
          </div>
        </div>
      </div>

      <!-- Recent probes chart (part of the service snapshot). It renders its
           zeroed frame immediately and animates values in when data lands. -->
      <div class="bg-background-primary p-3">
        <p class="text-text-secondary font-medium mb-2">
          {{ t('metrics.recentProbes') }}
        </p>
        <RecentProbesChart :data="recentProbes" />
      </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import RecentProbesChart from '@/components/core/graphs/RecentProbesChart.vue';
import { computeSuccessRate, formatMs, metricsSuccessStyle, statusTextClass } from '@/lib/metrics-utils';
import type { ProbePoint, ServiceSummary } from '@/data/services/ServiceDto';

const props = defineProps<{
  service: ServiceSummary;
  recentProbes: ProbePoint[];
}>();

const { t } = useI18n();

const totalProbes = computed(() =>
  props.service.metrics?.counters.probesTotal.toLocaleString() ?? '-');

const successRate = computed(() => {
  const rate = computeSuccessRate(props.service.metrics);
  return rate == null ? '-' : `${rate.toFixed(1)}%`;
});

/** Recent-probes mean when available, falling back to the last probe's value. */
const avgResponse = computed(() => {
  const points = props.recentProbes.filter(p => p.avgResponseMs > 0);
  if (points.length > 0) {
    return formatMs(points.reduce((s, p) => s + p.avgResponseMs, 0) / points.length);
  }
  const ms = props.service.metrics?.state.lastResponseMs;
  return ms ? formatMs(ms) : '-';
});
</script>

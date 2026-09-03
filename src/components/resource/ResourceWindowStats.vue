<template>
    <div class="px-gutter py-4">
      <!--  A single row of five stats plus a period select is ~600px wide and
            pushed the page sideways on a phone. Below the breakpoint the row
            becomes a two-column grid and the select drops under it — nothing
            shrinks, nothing scrolls off.  -->
      <div class="flex items-center justify-between mb-4 max-md:flex-col max-md:items-stretch max-md:gap-3">
        <div class="flex items-center gap-6 max-md:grid max-md:grid-cols-2 max-md:gap-x-4 max-md:gap-y-3">
          <!-- Static entity counts, separated from the window-scoped metrics -->
          <template v-if="staticStats.length > 0">
            <div
              v-for="stat in staticStats"
              :key="stat.label"
              class="min-w-0"
            >
              <SectionHeading class="mb-1" :label="stat.label" />
              <p class="text-2xl font-semibold text-text-primary">
                {{ stat.value }}
              </p>
            </div>
            <!-- Separator: a vertical rule has no meaning in a stacked grid. -->
            <div class="w-px h-10 bg-text-secondary/25 max-md:hidden" />
          </template>
          <div class="min-w-0">
            <SectionHeading class="mb-1" :label="t('metrics.successRate')" />
            <p
              class="text-2xl font-semibold"
              :style="successStyle"
            >
              {{ successRate }}
            </p>
          </div>
          <div class="min-w-0">
            <SectionHeading class="mb-1" :label="t('metrics.avgResponse')" />
            <p class="text-2xl font-semibold text-text-primary">
              {{ avgResponse }}
            </p>
          </div>
          <div class="min-w-0">
            <SectionHeading class="mb-1" :label="t('metrics.probesInWindow')" />
            <p class="text-2xl font-semibold text-text-primary">
              {{ probeCount }}
            </p>
          </div>
          <div class="min-w-0">
            <SectionHeading class="mb-1" :label="t('metrics.failuresInWindow')" />
            <p
              class="text-2xl font-semibold"
              :class="failureCount > 0 ? 'text-status-failure' : 'text-text-primary'"
            >
              {{ failureCount }}
            </p>
          </div>
        </div>
        <AppSelect
          v-model="period"
          :options="PERIOD_OPTIONS"
          class="w-18"
        />
      </div>

      <!-- Local spinner: history is a background fetch and can take seconds
           on large fleets — the chart area holds its space meanwhile. -->
      <div
        v-if="loading && history.length === 0"
        class="h-[200px] flex items-center justify-center"
      >
        <LoadingSpinner />
      </div>
      <HourlyBucketsChart
        v-else
        :buckets="filteredHistory"
      />
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import AppSelect from '@/components/core/input/AppSelect.vue';
import HourlyBucketsChart from '@/components/core/graphs/HourlyBucketsChart.vue';
import LoadingSpinner from '@/components/core/LoadingSpinner.vue';
import SectionHeading from '@/components/core/SectionHeading.vue';
import { successRateStyle } from '@/config/successRateColors';
import { formatMs } from '@/lib/metrics-utils';
import type { HourlyBucket } from '@/data/metrics/MetricsDto';
import type { SelectOption } from '@/types/ui/common';

/** A count that doesn't depend on the selected window (e.g. "Projects: 4"). */
interface StaticStat {
  label: string;
  value: string | number;
}

/**
 * Windowed metrics card of the resource header: success rate, average
 * response, probe/failure counts and the hourly chart, over a selectable
 * trailing window of the (24h) history.
 */
const props = withDefaults(
  defineProps<{
    history: HourlyBucket[];
    /** True while the (background) history fetch is in flight. */
    loading?: boolean;
    /** Window-independent counts shown before the separator. */
    staticStats?: StaticStat[];
  }>(),
  {
    loading: false,
    staticStats: () => [],
  }
);

const { t } = useI18n();

const PERIOD_OPTIONS: SelectOption[] = [
  { value: '24', label: '24h' },
  { value: '12', label: '12h' },
  { value: '6', label: '6h' },
  { value: '2', label: '2h' },
];

const period = ref<string>('24');

const filteredHistory = computed(() => props.history.slice(-parseInt(period.value)));

const totalInWindow = computed(() => filteredHistory.value.reduce((s, b) => s + b.total, 0));

const successRate = computed(() => {
  if (totalInWindow.value === 0) return '-';
  const success = filteredHistory.value.reduce((s, b) => s + b.success, 0);
  return `${((success / totalInWindow.value) * 100).toFixed(1)}%`;
});

const successStyle = computed(() => {
  if (totalInWindow.value === 0) return {};
  const success = filteredHistory.value.reduce((s, b) => s + b.success, 0);
  return successRateStyle((success / totalInWindow.value) * 100);
});

const avgResponse = computed(() => {
  // Use callCount when available; fall back to probe count (assumes ≥1 call per probe)
  const totalCalls = filteredHistory.value.reduce((s, b) => s + (b.callCount > 0 ? b.callCount : b.total), 0);
  if (totalCalls === 0) return '-';
  const totalMs = filteredHistory.value.reduce((s, b) => s + b.sumMs, 0);
  return formatMs(totalMs / totalCalls);
});

const probeCount = computed(() =>
  totalInWindow.value > 0 ? totalInWindow.value.toLocaleString() : '-');

const failureCount = computed(() =>
  filteredHistory.value.reduce((s, b) => s + b.failure + b.timeout, 0));
</script>

<template>
    <ChartCanvas
      type="bar"
      :data="chartData"
      :options="chartOptions"
      height="160px"
    />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ChartCanvas from '@/components/core/graphs/ChartCanvas.vue';
import { cssVar, formatMsTick, withAlpha } from '@/lib/charts';
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import type { HourlyBucket } from '@/data/metrics/MetricsDto';
import { formatTime } from '@/lib/dateFormat';

/**
 * Hourly probe activity: stacked success/failure bars with the average
 * response time overlaid as a line on a second axis.
 */
const props = defineProps<{
  buckets: HourlyBucket[];
}>();

const { t } = useI18n();

const PLACEHOLDER_BUCKETS = 24;

/** Zero-valued stand-ins so the chart renders its frame before data arrives. */
const points = computed<HourlyBucket[]>(() =>
  props.buckets.length > 0
    ? props.buckets
    : Array.from({ length: PLACEHOLDER_BUCKETS }, () => ({
      hour: '', total: 0, success: 0, failure: 0, timeout: 0, sumMs: 0, callCount: 0,
    })));

function avgMsOf(bucket: HourlyBucket): number {
  return bucket.sumMs / (bucket.callCount > 0 ? bucket.callCount : bucket.total || 1);
}

function formatBucketHour(hour: string): string {
  // hour format: "yyyyMMddHH", bucketed in UTC by the backend — convert to
  // the viewer's local hour for display.
  if (hour.length < 10) return hour;
  const utc = new Date(Date.UTC(
    Number(hour.slice(0, 4)),
    Number(hour.slice(4, 6)) - 1,
    Number(hour.slice(6, 8)),
    Number(hour.slice(8, 10)),
  ));
  return formatTime(utc);
}

const chartData = computed<ChartData>(() => ({
  labels: points.value.map(b => formatBucketHour(b.hour)),
  datasets: [
    {
      type: 'line',
      label: t('metrics.avgResponseMs'),
      data: points.value.map(b => Math.round(avgMsOf(b))),
      borderColor: cssVar('--chart-avg'),
      backgroundColor: cssVar('--chart-avg'),
      pointRadius: 2,
      borderWidth: 1.5,
      tension: 0.3,
      yAxisID: 'yMs',
    },
    {
      type: 'bar',
      label: t('metrics.successes'),
      data: points.value.map(b => b.success),
      backgroundColor: withAlpha(cssVar('--color-status-success'), '59'),
      stack: 'probes',
      yAxisID: 'y',
    },
    {
      type: 'bar',
      label: t('metrics.failuresInWindow'),
      data: points.value.map(b => b.failure + b.timeout),
      backgroundColor: withAlpha(cssVar('--color-status-failure'), '8C'),
      stack: 'probes',
      yAxisID: 'y',
    },
  ],
}));

const chartOptions = computed<ChartOptions>(() => {
  const textColor = cssVar('--color-text-secondary');
  const gridColor = cssVar('--chart-grid');
  return {
    scales: {
      x: {
        stacked: true,
        ticks: { color: textColor, maxTicksLimit: 8 },
        grid: { display: false },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: { color: textColor, precision: 0 },
        grid: { color: gridColor },
      },
      yMs: {
        beginAtZero: true,
        position: 'right',
        ticks: { color: textColor, callback: formatMsTick },
        grid: { display: false },
      },
    },
    plugins: {
      legend: {
        labels: { color: textColor, boxWidth: 12, boxHeight: 12 },
      },
      tooltip: {
        callbacks: {
          label: (item: TooltipItem<'bar' | 'line'>) =>
            item.dataset.yAxisID === 'yMs'
              ? `${item.dataset.label}: ${formatMsTick(item.parsed.y ?? 0)}`
              : `${item.dataset.label}: ${item.parsed.y}`,
        },
      },
    },
  };
});
</script>

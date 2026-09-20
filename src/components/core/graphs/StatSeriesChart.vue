<template>
    <ChartCanvas
      type="line"
      :data="chartData"
      :options="chartOptions"
      height="200px"
    />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ChartCanvas from '@/components/core/graphs/ChartCanvas.vue';
import { cssVar, withAlpha } from '@/lib/charts';
import { formatBucketLabel, formatMs } from '@/lib/metrics-utils';
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import type { StatBucket } from '@/data/metrics/MetricsDto';
import { lowerPercentBounds, upperPercentBounds } from '@/utils/percentAxis';

/**
 * A statistics time series read from `probe_aggregates`. `uptime` mode plots the
 * success and error-rate percentages; `latency` mode plots the p50/p95/p99
 * response-time percentiles.
 */
const props = defineProps<{
  buckets: StatBucket[];
  /** "hourly" | "daily" — drives the x-axis label format. */
  bucketType: string;
  mode: 'uptime' | 'latency';
}>();

const { t } = useI18n();

const labels = computed(() => props.buckets.map(b => formatBucketLabel(b.bucketStart, props.bucketType)));

const chartData = computed<ChartData>(() => {
  if (props.mode === 'uptime') {
    return {
      labels: labels.value,
      datasets: [
        {
          label: t('statistics.uptimePct'),
          data: props.buckets.map(b => b.uptimePct),
          borderColor: cssVar('--chart-success'),
          backgroundColor: withAlpha(cssVar('--chart-success'), '33'),
          fill: true,
          pointRadius: 0,
          borderWidth: 1.5,
          cubicInterpolationMode: 'monotone' as const,
          yAxisID: 'y',
          spanGaps: true,
        },
        {
          label: t('statistics.errorRatePct'),
          data: props.buckets.map(b => b.errorRatePct),
          borderColor: cssVar('--chart-failure'),
          backgroundColor: cssVar('--chart-failure'),
          pointRadius: 0,
          borderWidth: 1.5,
          cubicInterpolationMode: 'monotone' as const,
          yAxisID: 'yErr',
          spanGaps: true,
        },
      ],
    };
  }
  return {
    labels: labels.value,
    datasets: [
      { key: 'p50', color: '--chart-dimmed', data: props.buckets.map(b => b.p50Ms) },
      { key: 'p95', color: '--chart-line', data: props.buckets.map(b => b.p95Ms) },
      { key: 'p99', color: '--chart-warning', data: props.buckets.map(b => b.p99Ms) },
    ].map(s => ({
      label: t(`statistics.${s.key}`),
      data: s.data,
      borderColor: cssVar(s.color),
      backgroundColor: cssVar(s.color),
      pointRadius: 0,
      borderWidth: 1.5,
      tension: 0.3,
      yAxisID: 'yMs',
      spanGaps: true,
    })),
  };
});

const chartOptions = computed<ChartOptions>(() => {
  const textColor = cssVar('--color-text-secondary');
  const gridColor = cssVar('--chart-grid');
  const base = {
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { labels: { color: textColor, boxWidth: 12, boxHeight: 12 } },
    },
  };
  if (props.mode === 'uptime') {
    return {
      ...base,
      scales: {
        x: { ticks: { color: textColor, maxTicksLimit: 8 }, grid: { display: false } },
        y: {
          position: 'left',
          // Auto-scaled (not zero-based) so small uptime dips near 100% are
          // visible — but never past 100, which a flat series otherwise gets.
          ...upperPercentBounds(props.buckets.map(b => b.uptimePct)),
          ticks: { color: textColor, callback: (v) => `${v}%` },
          grid: { color: gridColor },
        },
        yErr: {
          position: 'right',
          ...lowerPercentBounds(props.buckets.map(b => b.errorRatePct)),
          ticks: { color: textColor, callback: (v) => `${v}%` },
          grid: { display: false },
        },
      },
      plugins: {
        ...base.plugins,
        tooltip: {
          callbacks: {
            label: (item: TooltipItem<'line'>) => `${item.dataset.label}: ${item.parsed.y ?? '—'}%`,
          },
        },
      },
    };
  }
  return {
    ...base,
    scales: {
      x: { ticks: { color: textColor, maxTicksLimit: 8 }, grid: { display: false } },
      yMs: {
        beginAtZero: true,
        // The statistics tab speaks one duration format throughout — the same
        // one the summary tiles and the per-endpoint panels use.
        ticks: { color: textColor, callback: value => formatMs(Number(value)) },
        grid: { color: gridColor },
      },
    },
    plugins: {
      ...base.plugins,
      tooltip: {
        callbacks: {
          label: (item: TooltipItem<'line'>) => `${item.dataset.label}: ${formatMs(item.parsed.y ?? 0)}`,
        },
      },
    },
  };
});
</script>

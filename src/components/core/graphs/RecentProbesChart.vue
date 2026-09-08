<template>
    <ChartCanvas
      type="bar"
      :data="chartData"
      :options="chartOptions"
      :plugins="[avgLabelPlugin]"
      height="180px"
    />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ChartCanvas from '@/components/core/graphs/ChartCanvas.vue';
import { cssVar, formatMsTick, withAlpha } from '@/lib/charts';
import type { ChartData, ChartOptions, Plugin, TooltipItem } from 'chart.js';
import type { ProbePoint } from '@/data/services/ServiceDto';
import { formatTime } from '@/lib/dateFormat';

/**
 * Per-probe history of one service: average response time as a line (points
 * colored by probe status) with failed-call counts as bars on a second axis.
 */
const props = defineProps<{
  data: ProbePoint[];
}>();

const { t } = useI18n();

const PLACEHOLDER_POINTS = 10;

/** Zero-valued stand-ins so the chart renders its frame before data arrives. */
const points = computed<ProbePoint[]>(() =>
  props.data.length > 0
    ? props.data
    : Array.from({ length: PLACEHOLDER_POINTS }, () => ({
      status: 'success', avgResponseMs: 0, callCount: 0, failedCalls: 0, timestamp: 0,
    })));

const isPlaceholder = computed(() => props.data.length === 0);

/**
 * Dashed average line across the window — only for services that actually
 * have timing data (fail-only/connection-error probes report 0ms and would
 * make a meaningless average).
 */
const avgBaseline = computed(() => {
  const timed = props.data.filter(p => p.avgResponseMs > 0);
  if (timed.length === 0) return 0;
  return Math.round(timed.reduce((sum, p) => sum + p.avgResponseMs, 0) / timed.length);
});

const AVG_DATASET_LABEL = 'avg-baseline';

/** Draws the "avg 123 ms" tag at the right end of the average line. */
const avgLabelPlugin: Plugin = {
  id: 'avgBaselineLabel',
  afterDatasetsDraw(chart) {
    if (avgBaseline.value <= 0) return;
    const yScale = chart.scales.y;
    if (!yScale) return;
    const y = yScale.getPixelForValue(avgBaseline.value);
    const { ctx, chartArea } = chart;
    ctx.save();
    ctx.font = '9px sans-serif';
    ctx.fillStyle = cssVar('--chart-avg');
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${t('metrics.avgShort')} ${formatMsTick(avgBaseline.value)}`, chartArea.right - 2, y - 2);
    ctx.restore();
  },
};

function statusColor(status: string): string {
  if (status === 'success') return cssVar('--chart-success');
  if (status === 'timeout') return cssVar('--chart-warning');
  if (status === 'skipped') return cssVar('--chart-dimmed');
  return cssVar('--chart-failure');
}

function formatTimestamp(epoch: number): string {
  if (epoch === 0) return '';
  return formatTime(epoch * 1000);
}

const chartData = computed<ChartData>(() => ({
  labels: points.value.map(p => formatTimestamp(p.timestamp)),
  datasets: [
    {
      type: 'line',
      label: t('metrics.avgResponseMs'),
      data: points.value.map(p => p.avgResponseMs),
      borderColor: cssVar('--chart-avg'),
      backgroundColor: cssVar('--chart-avg'),
      pointBackgroundColor: points.value.map(p => statusColor(p.status)),
      pointBorderColor: points.value.map(p => statusColor(p.status)),
      pointRadius: isPlaceholder.value ? 0 : 4,
      borderWidth: 1.5,
      tension: 0.3,
      // Failed probes often sit at 0ms — don't clip their status dots in
      // half against the baseline.
      clip: false,
      yAxisID: 'y',
    },
    {
      type: 'bar',
      label: t('metrics.failedCalls'),
      data: points.value.map(p => p.failedCalls),
      backgroundColor: withAlpha(cssVar('--color-status-failure'), '66'),
      yAxisID: 'yCount',
    },
    ...(avgBaseline.value > 0 ? [{
      type: 'line' as const,
      label: AVG_DATASET_LABEL,
      data: points.value.map(() => avgBaseline.value),
      borderColor: cssVar('--chart-avg'),
      borderWidth: 1,
      borderDash: [4, 2],
      pointRadius: 0,
      pointHitRadius: 0,
      yAxisID: 'y',
    }] : []),
  ],
}));

const chartOptions = computed<ChartOptions>(() => {
  const textColor = cssVar('--color-text-secondary');
  const gridColor = cssVar('--chart-grid');
  return {
    scales: {
      x: {
        ticks: { color: textColor, maxTicksLimit: 6 },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: { color: textColor, callback: formatMsTick },
        grid: { color: gridColor },
      },
      yCount: {
        beginAtZero: true,
        position: 'right',
        ticks: { color: textColor, precision: 0 },
        grid: { display: false },
      },
    },
    plugins: {
      legend: {
        labels: {
          color: textColor,
          boxWidth: 12,
          boxHeight: 12,
          // The average line carries its own on-chart label.
          filter: (item) => item.text !== AVG_DATASET_LABEL,
        },
      },
      tooltip: {
        filter: (item: TooltipItem<'bar' | 'line'>) => item.dataset.label !== AVG_DATASET_LABEL,
        callbacks: {
          label: (item: TooltipItem<'bar' | 'line'>) =>
            item.dataset.yAxisID === 'y'
              ? `${item.dataset.label}: ${formatMsTick(item.parsed.y ?? 0)}`
              : `${item.dataset.label}: ${item.parsed.y}`,
        },
      },
    },
  };
});
</script>

<template>
    <ChartCanvas
      type="bar"
      :data="chartData"
      :options="chartOptions"
      :plugins="[previousTotalMarker]"
      :height="height"
    />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ChartCanvas from '@/components/core/graphs/ChartCanvas.vue';
import { cssVar } from '@/lib/charts';
import { formatMs } from '@/lib/metrics-utils';
import { useViewport } from '@/composables/useViewport';
import { buildEndpointPhasesModel, endpointLabel, formatDeltaMs, type PhaseKey } from '@/utils/endpointStats';
import type { StatWindow } from '@/store/core/statistics';
import type { ChartData, ChartOptions, Plugin, TooltipItem } from 'chart.js';
import type { EndpointStat } from '@/data/metrics/MetricsDto';

/**
 * Where an endpoint's time goes: one horizontal stacked bar per endpoint, the
 * window's average DNS / Connect / TLS / TTFB / Transfer, with a marker at the
 * previous period's total so a bar that has grown says so on sight.
 */
const props = defineProps<{
  endpoints: EndpointStat[];
  /** The selected window — the previous period is one of equal length before it. */
  window: StatWindow;
}>();

const { t } = useI18n();
const { isMobile } = useViewport();

const LABEL_CHARS_MOBILE = 20;
const LABEL_CHARS_DESKTOP = 40;

/** Tallest half-marker, in pixels — the cap for a chart with very few rows. */
const MARKER_MAX_HALF_HEIGHT = 18;

const model = computed(() => buildEndpointPhasesModel(props.endpoints));

const labels = computed(() =>
  model.value.rows.map(e => endpointLabel(e, isMobile.value ? LABEL_CHARS_MOBILE : LABEL_CHARS_DESKTOP)));

const height = computed(() => `${Math.max(160, model.value.rows.length * 34 + 56)}px`);

/** Phase names, reusing the labels the call detail already shows. */
const phaseLabels = computed<Record<PhaseKey, string>>(() => ({
  dns: t('metrics.dns'),
  connect: t('metrics.connect'),
  tls: t('metrics.tls'),
  ttfb: t('metrics.ttfb'),
  transfer: t('metrics.transfer'),
}));

/** "24 hours" / "7 days" — the span the comparison is against, in words. */
const periodLabels = computed<Record<StatWindow, string>>(() => ({
  '24h': t('statistics.previousPeriod24h'),
  '7d': t('statistics.previousPeriod7d'),
  '30d': t('statistics.previousPeriod30d'),
  '90d': t('statistics.previousPeriod90d'),
}));

const chartData = computed<ChartData<'bar'>>(() => ({
  labels: labels.value,
  datasets: model.value.series.map(s => ({
    label: phaseLabels.value[s.phase],
    data: s.values,
    backgroundColor: cssVar(s.colorVar),
    borderWidth: 0,
    stack: 'phases',
    maxBarThickness: 28,
  })),
}));

/**
 * The marker, drawn after the bars.
 *
 * A plugin rather than a second dataset: a dataset would need its own scale,
 * its own legend entry and a controller the app does not register, while this
 * is one stroke per row. It reads the model at draw time, so a window switch
 * moves the markers with the bars.
 */
const previousTotalMarker: Plugin<'bar'> = {
  id: 'previousTotalMarker',
  afterDatasetsDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    const xScale = scales.x;
    const yScale = scales.y;
    if (!xScale || !yScale) return;
    // Slightly taller than the bar (which takes ~0.72 of a row), so the marker
    // overhangs it and stays visible where it lands on a segment boundary.
    const pitch = model.value.rows.length > 0
      ? (chartArea.bottom - chartArea.top) / model.value.rows.length
      : 0;
    const half = Math.max(5, Math.min(MARKER_MAX_HALF_HEIGHT, pitch * 0.42));
    ctx.save();
    ctx.strokeStyle = cssVar('--color-text-primary');
    ctx.lineWidth = 3;
    model.value.previousTotals.forEach((total, index) => {
      if (total == null) return;
      const x = xScale.getPixelForValue(total);
      if (x < chartArea.left || x > chartArea.right) return;
      const y = yScale.getPixelForValue(index);
      ctx.beginPath();
      ctx.moveTo(x, y - half);
      ctx.lineTo(x, y + half);
      ctx.stroke();
    });
    ctx.restore();
  },
};

const chartOptions = computed<ChartOptions<'bar'>>(() => {
  const textColor = cssVar('--color-text-secondary');
  const gridColor = cssVar('--chart-grid');
  return {
    indexAxis: 'y',
    scales: {
      x: {
        stacked: true,
        beginAtZero: true,
        ticks: { color: textColor, callback: value => formatMs(Number(value)) },
        grid: { color: gridColor },
      },
      y: {
        stacked: true,
        ticks: { color: textColor, autoSkip: false },
        grid: { display: false },
      },
    },
    plugins: {
      legend: { labels: { color: textColor, boxWidth: 12, boxHeight: 12 } },
      tooltip: {
        callbacks: {
          title: (items: TooltipItem<'bar'>[]) => {
            const row = model.value.rows[items[0]?.dataIndex ?? 0];
            if (!row) return '';
            return row.exampleUrl ? [row.key, row.exampleUrl] : [row.key];
          },
          label: (item: TooltipItem<'bar'>) => {
            const series = model.value.series[item.datasetIndex];
            if (!series) return '';
            const value = formatMs(series.values[item.dataIndex] ?? 0);
            const phase = phaseLabels.value[series.phase];
            const delta = series.deltas[item.dataIndex];
            // No previous period for this endpoint — a value, and nothing invented.
            if (delta == null) return t('statistics.endpointPhaseValue', { phase, value });
            return t('statistics.endpointPhaseDelta', {
              phase,
              value,
              delta: formatDeltaMs(delta),
              period: periodLabels.value[props.window],
            });
          },
        },
      },
    },
  };
});
</script>

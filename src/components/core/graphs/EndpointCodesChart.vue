<template>
    <div class="space-y-2">
      <!--  Only offered when there is something underneath the 2xx to look at;
            with nothing but successes the switch would be a control that does
            nothing, so it is not drawn at all.  -->
      <div
        v-if="canHideSuccess"
        class="flex items-center justify-end gap-2"
      >
        <span class="text-xs text-text-secondary">{{ t('statistics.hideSuccessCodes') }}</span>
        <ToggleSwitch v-model="hideSuccess" />
      </div>

      <ChartCanvas
        type="bar"
        :data="chartData"
        :options="chartOptions"
        :height="height"
      />
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import ChartCanvas from '@/components/core/graphs/ChartCanvas.vue';
import ToggleSwitch from '@/components/core/input/ToggleSwitch.vue';
import { cssVar } from '@/lib/charts';
import { formatCount } from '@/lib/metrics-utils';
import { useViewport } from '@/composables/useViewport';
import { buildEndpointCodesModel, endpointLabel, hasNonSuccessCodes } from '@/utils/endpointStats';
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import type { EndpointStat } from '@/data/metrics/MetricsDto';

/**
 * Status codes per endpoint over the window: one row per endpoint, one bar per
 * code the window saw, coloured by class.
 *
 * Rows run horizontally and the canvas grows downward with them. An endpoint
 * label is a method and a path — twenty of those on a vertical axis are
 * rotated into unreadability, while twenty rows are a page scroll, which the
 * tab already has. It is also the only layout that survives a 360px screen
 * without a horizontal scroller of its own.
 */
const props = defineProps<{
  endpoints: EndpointStat[];
}>();

const { t } = useI18n();
const { isMobile } = useViewport();

/** Label budget: a phone gives the y axis far less room than a desktop does. */
const LABEL_CHARS_MOBILE = 20;
const LABEL_CHARS_DESKTOP = 40;

const canHideSuccess = computed(() => hasNonSuccessCodes(props.endpoints));

// Default ON whenever there is a non-2xx: a bar of 8,640 successes flattens
// the nine 503s beside it to nothing, and the 503s are the reason to look.
const hideSuccess = ref<boolean>(canHideSuccess.value);
watch(canHideSuccess, (can) => { hideSuccess.value = can; });

const model = computed(() => buildEndpointCodesModel(props.endpoints, hideSuccess.value));

const labels = computed(() =>
  model.value.rows.map(e => endpointLabel(e, isMobile.value ? LABEL_CHARS_MOBILE : LABEL_CHARS_DESKTOP)));

/** Row height grows with the number of bars a row carries, so bars stay touchable. */
const height = computed(() => {
  const perRow = Math.max(26, model.value.series.length * 14 + 12);
  return `${Math.max(160, model.value.rows.length * perRow + 56)}px`;
});

function codeLabel(code: number): string {
  return code === 0 ? t('statistics.endpointNoResponse') : String(code);
}

const chartData = computed<ChartData<'bar'>>(() => ({
  labels: labels.value,
  datasets: model.value.series.map(s => ({
    label: codeLabel(s.code),
    data: s.counts,
    backgroundColor: cssVar(s.colorVar),
    borderWidth: 0,
    // A chart down to one endpoint (which "Hide 2xx" often produces) otherwise
    // gives that row the whole canvas and draws a slab.
    maxBarThickness: 18,
  })),
}));

const chartOptions = computed<ChartOptions<'bar'>>(() => {
  const textColor = cssVar('--color-text-secondary');
  const gridColor = cssVar('--chart-grid');
  return {
    indexAxis: 'y',
    scales: {
      x: {
        beginAtZero: true,
        // Calls are whole things — a "2.5 calls" gridline would be nonsense.
        ticks: { color: textColor, precision: 0 },
        grid: { color: gridColor },
      },
      y: {
        // Every endpoint keeps its label; the canvas grew to fit them.
        ticks: { color: textColor, autoSkip: false },
        grid: { display: false },
      },
    },
    plugins: {
      legend: { labels: { color: textColor, boxWidth: 12, boxHeight: 12 } },
      tooltip: {
        callbacks: {
          // The axis label is shortened; the tooltip carries the whole key and
          // a real URL it stood for.
          title: (items: TooltipItem<'bar'>[]) => {
            const row = model.value.rows[items[0]?.dataIndex ?? 0];
            if (!row) return '';
            return row.exampleUrl ? [row.key, row.exampleUrl] : [row.key];
          },
          label: (item: TooltipItem<'bar'>) => {
            const series = model.value.series[item.datasetIndex];
            const count = series?.counts[item.dataIndex] ?? 0;
            const share = series?.shares[item.dataIndex] ?? 0;
            const detail = t(
              'statistics.endpointCodeTooltip',
              { count: formatCount(count), share: share.toFixed(1) },
              count,
            );
            return `${item.dataset.label}: ${detail}`;
          },
        },
      },
    },
  };
});
</script>

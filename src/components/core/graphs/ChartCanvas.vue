<template>
    <!--  `min-w-0` + `overflow-hidden`: Chart.js sizes the canvas from the
          container, so a container that can grow with its canvas (a flex or
          grid child, whose default min-width is its content) never shrinks
          back and pushes the page sideways on a phone.  -->
    <div
      class="relative w-full min-w-0 overflow-hidden"
      :style="{ height }"
    >
      <canvas
        ref="canvasEl"
        class="max-w-full"
      />
    </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Chart } from 'chart.js';
import { registerCharts } from '@/lib/charts';
import type { ChartConfiguration, ChartData, ChartOptions, ChartType, Plugin } from 'chart.js';

/**
 * Thin Chart.js host: renders the given config into a fixed-height canvas and
 * applies data/options changes in place (no animation) instead of re-creating
 * the chart.
 */
const props = withDefaults(
  defineProps<{
    type: ChartType;
    data: ChartData;
    options?: ChartOptions;
    height?: string;
    /** Chart-local plugins, applied at creation (not reactive). */
    plugins?: Plugin[];
  }>(),
  {
    options: undefined,
    height: '200px',
    plugins: () => [],
  }
);

registerCharts();

const canvasEl = ref<HTMLCanvasElement | null>(null);
let chart: Chart | null = null;

onMounted(() => {
  if (!canvasEl.value) return;
  const config: ChartConfiguration = {
    type: props.type,
    data: props.data,
    options: { maintainAspectRatio: false, responsive: true, ...props.options },
    plugins: props.plugins,
  };
  chart = new Chart(canvasEl.value, config);
});

// First real data animates into position (charts pre-render with zeroed
// datasets); every later change — live deltas, period switches — applies
// in place with no animation so the chart grows instead of jumping.
let animatedOnce = false;
watch(() => props.data, (data) => {
  if (!chart) return;
  chart.data = data;
  chart.update(animatedOnce ? 'none' : undefined);
  animatedOnce = true;
}, { deep: true });

onBeforeUnmount(() => {
  chart?.destroy();
  chart = null;
});
</script>

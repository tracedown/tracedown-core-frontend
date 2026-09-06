<template>
    <div class="pl-5 pb-3 space-y-2">
      <div class="flex items-center gap-3">
        <SectionHeading :label="t('agents.history')" />
        <AppSelect
          v-model="hours"
          class="w-20"
          :options="PERIOD_OPTIONS"
        />
        <span
          v-if="checks.length > 0"
          class="text-xs text-text-secondary ml-auto"
        >
          {{ t('agents.passRate', { rate: passRate, total: checks.length }) }}
        </span>
      </div>

      <LoadingState v-if="loading" />
      <EmptyState
        v-else-if="checks.length === 0"
        compact
        :message="t('agents.noChecks')"
      />
      <ChartCanvas
        v-else
        type="line"
        :data="chartData"
        :options="chartOptions"
        height="160px"
      />
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import AppSelect from '@/components/core/input/AppSelect.vue';
import ChartCanvas from '@/components/core/graphs/ChartCanvas.vue';
import EmptyState from '@/components/core/EmptyState.vue';
import LoadingState from '@/components/core/LoadingState.vue';
import SectionHeading from '@/components/core/SectionHeading.vue';
import { useAgentStore } from '@/store/core/agent';
import { cssVar, formatMsTick } from '@/lib/charts';
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import type { AgentHealthCheck } from '@/data/agents/AgentDto';
import type { SelectOption } from '@/types/ui/common';
import { formatShortDateTime } from '@/lib/dateFormat';

/**
 * Health-check history of one agent: round-trip latency over time, failed
 * challenges as red zero-line points. Window kept by the retention job
 * (AGENT_HEALTH_RETENTION_DAYS, default 90d).
 */
const props = defineProps<{
  slug: string;
}>();

const { t } = useI18n();
const agentStore = useAgentStore();

const PERIOD_OPTIONS: SelectOption[] = [
  { value: '2', label: '2h' },
  { value: '6', label: '6h' },
  { value: '24', label: '24h' },
  { value: '72', label: '3d' },
  { value: '168', label: '7d' },
];

const hours = ref<string>('24');
const checks = ref<AgentHealthCheck[]>([]);
const loading = ref<boolean>(false);

const passRate = computed(() => {
  if (checks.value.length === 0) return 0;
  const passed = checks.value.filter(c => c.result === 'pass').length;
  return Math.round((passed / checks.value.length) * 100);
});

function timeLabel(check: AgentHealthCheck): string {
  return formatShortDateTime(check.challengedAt);
}

const chartData = computed<ChartData>(() => ({
  labels: checks.value.map(timeLabel),
  datasets: [
    {
      label: t('agents.roundTrip'),
      data: checks.value.map(c => c.roundTripMs ?? 0),
      borderColor: cssVar('--chart-line'),
      backgroundColor: cssVar('--chart-line'),
      pointBackgroundColor: checks.value.map(c =>
        c.result === 'pass' ? cssVar('--chart-success') : cssVar('--chart-failure')),
      pointBorderColor: checks.value.map(c =>
        c.result === 'pass' ? cssVar('--chart-success') : cssVar('--chart-failure')),
      pointRadius: 2.5,
      borderWidth: 1.5,
      tension: 0.3,
      clip: false,
    },
  ],
}));

const chartOptions = computed<ChartOptions>(() => {
  const textColor = cssVar('--color-text-secondary');
  return {
    scales: {
      x: {
        ticks: { color: textColor, maxTicksLimit: 8 },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: { color: textColor, callback: formatMsTick },
        grid: { color: cssVar('--chart-grid') },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (item: TooltipItem<'line'>) => {
            const check = checks.value[item.dataIndex];
            const latency = check?.roundTripMs != null ? formatMsTick(check.roundTripMs) : '—';
            return `${t(`agents.results.${check?.result === 'pass' ? 'pass' : 'fail'}`)}: ${latency}`;
          },
        },
      },
    },
  };
});

// Only the newest request may write state — fast period switches would
// otherwise let an older response land last and display the wrong window.
let loadSeq = 0;

async function load() {
  const seq = ++loadSeq;
  loading.value = true;
  try {
    const result = await agentStore.fetchChecks(props.slug, Number(hours.value));
    if (seq !== loadSeq) return;
    checks.value = result.ok ? result.data ?? [] : [];
  } finally {
    if (seq === loadSeq) loading.value = false;
  }
}

watch(hours, () => {
  void load();
});

onMounted(() => {
  void load();
});
</script>

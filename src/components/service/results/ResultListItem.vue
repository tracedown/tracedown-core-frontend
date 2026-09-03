<template>
    <button
      class="w-full text-left px-2 py-1.5 text-xs transition-colors"
      :class="selected
        ? 'bg-accent-primary/10 border border-accent-primary/30'
        : 'hover:bg-background-primary border border-transparent'"
      @click="emit('select')"
    >
      <div class="flex items-center gap-2">
        <span
          class="inline-block w-2 h-2 rounded-full flex-shrink-0"
          :class="statusDotClass(result.status)"
        />
        <span class="text-text-primary truncate min-w-0">{{ result.status }}</span>
        <span class="text-text-secondary ml-auto flex-shrink-0">{{ result.totalResponseMs }}ms</span>
      </div>
      <div class="flex items-center gap-2 text-text-secondary mt-0.5 pl-4">
        <span>{{ formatAgo(result.startedAt) }}</span>
        <span
          v-if="result.agentSlug"
          class="text-text-secondary/60"
        >{{ result.agentSlug }}</span>
      </div>
    </button>
</template>

<script setup lang="ts">
import { statusDotClass } from '@/lib/metrics-utils';
import { useRelativeTime } from '@/composables/useRelativeTime';
import type { ProbeResultSummary } from '@/data/results/ResultDto';

defineProps<{
  result: ProbeResultSummary;
  selected: boolean;
}>();

const emit = defineEmits<{
  select: [];
}>();

const { formatAgo } = useRelativeTime();
</script>

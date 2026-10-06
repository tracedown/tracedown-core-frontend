<template>
    <div
      v-if="assertions.length > 0"
      class="text-xs space-y-1"
    >
      <p class="text-text-secondary font-medium">
        {{ t('results.assertions') }}
      </p>
      <div
        v-for="(a, i) in assertions"
        :key="i"
        class="flex items-center gap-2 px-2 py-1 max-md:flex-wrap"
        :class="tone(a.outcome).row"
      >
        <span
          class="w-1.5 h-1.5 rounded-full flex-shrink-0"
          :class="tone(a.outcome).dot"
        />
        <template v-if="a.type === 'scope'">
          <span class="text-text-primary font-medium">{{ a.scope }}</span>
          <span class="text-text-secondary">{{ a.op }}</span>
          <span class="text-text-primary font-mono break-all">{{ a.expected }}</span>
          <template v-if="a.outcome !== 'passed' && a.actual !== ''">
            <span class="text-text-secondary">→</span>
            <span
              class="font-mono break-all"
              :class="tone(a.outcome).text"
            >{{ a.actual }}</span>
          </template>
        </template>
        <template v-else>
          <span class="text-text-primary font-mono break-all">{{ a.expression || a.kind }}</span>
          <template v-if="a.outcome !== 'passed'">
            <span class="text-text-secondary">→</span>
            <span
              class="font-mono break-all"
              :class="tone(a.outcome).text"
            >{{ a.actualLhs }}</span>
            <span class="text-text-secondary">{{ t('results.versus') }}</span>
            <span class="text-text-primary font-mono break-all">{{ a.actualRhs }}</span>
          </template>
        </template>
        <span
          class="ml-auto"
          :class="tone(a.outcome).text"
        >
          {{ outcomeLabel(a.outcome) }}
        </span>
      </div>
    </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { ParsedAssertion } from '@/data/results/ResultDto';

defineProps<{ assertions: ParsedAssertion[] }>();

const { t, te } = useI18n();

/** Passed is green, failed red; `indeterminate` (a null operand, spec §5.4) is neither. */
function tone(outcome: string): { row: string; dot: string; text: string } {
  if (outcome === 'passed') {
    return { row: 'bg-status-success/5', dot: 'bg-status-success', text: 'text-status-success' };
  }
  if (outcome === 'failed') {
    return { row: 'bg-status-failure/5', dot: 'bg-status-failure', text: 'text-status-failure' };
  }
  return { row: 'bg-status-warning/5', dot: 'bg-status-warning', text: 'text-status-warning' };
}

function outcomeLabel(outcome: string): string {
  const key = `results.assertionOutcome.${outcome}`;
  return te(key) ? t(key) : outcome;
}
</script>

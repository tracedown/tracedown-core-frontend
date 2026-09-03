<template>
    <div class="pb-3 px-3">
      <p
        v-if="entry.comment"
        class="text-sm text-text-primary mb-2"
      >
        {{ entry.comment }}
      </p>
      <template v-if="entry.diff">
        <!-- Script changes render as a colored line diff -->
        <div
          v-if="scriptDiff"
          class="text-xs font-mono bg-background-primary rounded p-2 overflow-x-auto"
        >
          <p
            v-if="versionLine"
            class="text-text-secondary mb-1"
          >
            {{ versionLine }}
          </p>
          <pre
            v-for="(line, index) in scriptDiff"
            :key="index"
            class="whitespace-pre"
            :class="diffLineClass(line)"
          >{{ line || ' ' }}</pre>
        </div>
        <pre
          v-else
          class="text-xs font-mono text-text-secondary bg-background-primary rounded p-2
                 overflow-x-auto whitespace-pre"
        >{{ prettyDiff(entry.diff) }}</pre>
      </template>
      <p
        v-if="!entry.comment && !entry.diff"
        class="text-xs text-text-secondary italic"
      >
        {{ t('audit.noDetail') }}
      </p>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AuditLogEntry } from '@/data/audit/AuditDto';

/**
 * Expanded audit-row detail: the free-text comment plus the diff payload,
 * rendered as a colored line diff for script changes and pretty-printed JSON
 * otherwise.
 */
const props = defineProps<{
  entry: AuditLogEntry;
}>();

const { t } = useI18n();

function prettyDiff(diff: string): string {
  try {
    return JSON.stringify(JSON.parse(diff), null, 2);
  } catch {
    return diff;
  }
}

/** Lines of the unified script diff, when the entry carries one. */
const scriptDiff = computed<string[] | null>(() => {
  if (!props.entry.diff) return null;
  try {
    const parsed = JSON.parse(props.entry.diff);
    if (typeof parsed?.scriptDiff !== 'string' || parsed.scriptDiff.length === 0) return null;
    return parsed.scriptDiff.split('\n');
  } catch {
    return null;
  }
});

const versionLine = computed<string | null>(() => {
  try {
    const version = JSON.parse(props.entry.diff ?? '{}')?.version;
    if (version?.from == null) return null;
    return `v${version.from} → v${version.to}`;
  } catch {
    return null;
  }
});

function diffLineClass(line: string): string {
  if (line.startsWith('+')) return 'text-status-success';
  if (line.startsWith('-')) return 'text-status-failure';
  if (line.startsWith('@@')) return 'text-text-secondary/70';
  return 'text-text-secondary';
}
</script>

<template>
    <div class="space-y-3 max-w-sm">
      <SectionHeading :label="t('account.exportSection')" />

      <p class="text-xs text-text-secondary">
        {{ t('account.exportHint') }}
      </p>

      <PrimaryButton
        :label-text="t('account.exportButton')"
        :loading="exporting"
        :on-click="handleExport"
      />
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import SectionHeading from '@/components/core/SectionHeading.vue';
import { useAuthStore } from '@/store/core/auth';
import { useNotificationStore } from '@/store/ui/notifications';
import { getDataExportContributors } from '@/config/extensions';

/**
 * Personal data export section: downloads the export document as a JSON file.
 *
 * Exactly one file leaves this button. Sections a host has registered are
 * fetched alongside the built-in document and merged into it, so an install that
 * stores personal data beyond the app's own still answers the request with a
 * single copy rather than a set of files the reader has to piece together.
 */
const { t } = useI18n();
const authStore = useAuthStore();
const notifications = useNotificationStore();

const exporting = ref<boolean>(false);

/** Triggers a browser download of `content` as `filename`. */
function downloadJson(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function handleExport() {
  if (exporting.value) return;
  exporting.value = true;
  try {
    const result = await authStore.fetchDataExport();
    if (!result.ok || !result.data) {
      notifications.show(result.message ?? t('common.states.error'), 'error');
      return;
    }
    const exportDocument: Record<string, unknown> = { ...result.data };
    // Every registered section has to arrive before anything is handed over: a
    // partial copy is indistinguishable from a complete one once downloaded, so
    // a section that fails — or that would overwrite one already present —
    // cancels the download instead of quietly shrinking it.
    for (const contributor of getDataExportContributors()) {
      if (contributor.section in exportDocument) {
        notifications.show(t('common.states.error'), 'error');
        return;
      }
      const contribution = await contributor.load();
      if (!contribution.ok || contribution.data === undefined) {
        notifications.show(contribution.message ?? t('common.states.error'), 'error');
        return;
      }
      exportDocument[contributor.section] = contribution.data;
    }
    const date = result.data.generatedAt.slice(0, 10);
    downloadJson(JSON.stringify(exportDocument, null, 2), `tracedown-data-export-${date}.json`);
  } finally {
    exporting.value = false;
  }
}
</script>

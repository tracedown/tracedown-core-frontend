<template>
    <div
      role="alert"
      class="flex items-center gap-3 flex-wrap border border-status-failure/30 bg-status-failure/5 px-3 py-2"
    >
      <p class="text-sm text-text-primary min-w-0">
        {{ message || t('apiKeys.loadFailed') }}
      </p>
      <SecondaryButton
        :label-text="t('apiKeys.retry')"
        :fa-icon="faRotateRight"
        :on-click="() => emit('retry')"
      />
    </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { faRotateRight } from '@fortawesome/free-solid-svg-icons';
import SecondaryButton from '@/components/core/buttons/SecondaryButton.vue';

/**
 * A key list that could not be fetched: says so, with a way to try again,
 * where the list (or its empty state) would be — never a claim that there are
 * no keys. Any rows already shown stay below it.
 */
defineProps<{
  /** The failure, already localized; empty for a generic one. */
  message: string;
}>();

const emit = defineEmits<{ retry: [] }>();

const { t } = useI18n();
</script>

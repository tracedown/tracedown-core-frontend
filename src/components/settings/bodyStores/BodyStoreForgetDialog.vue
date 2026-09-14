<template>
    <ModalDialog
      :modal-name="t('bodyStores.forget.title', { name: store.name })"
      @close="emit('close')"
    >
      <div class="space-y-2 max-w-md p-2 max-md:p-0">
        <p class="text-sm text-text-primary">
          {{ t('bodyStores.forget.explain') }}
        </p>
        <p class="text-xs text-status-failure">
          {{ t('bodyStores.forget.warning') }}
        </p>
        <p class="text-xs text-text-secondary">
          {{ t('bodyStores.forget.objectsKept') }}
        </p>
        <p
          v-if="error"
          class="text-xs text-status-failure"
        >
          {{ error }}
        </p>
      </div>

      <template #footer>
        <div class="flex items-center gap-2 px-2 pb-2 max-md:p-0">
          <DangerButton
            :label-text="t('bodyStores.forget.confirm')"
            :hold-offset-sec="3"
            :loading="submitting"
            @safe-click="submit"
          />
          <GhostButton
            :label-text="t('common.actions.cancel')"
            :on-click="() => emit('close')"
          />
        </div>
      </template>
    </ModalDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ModalDialog from '@/components/core/ModalDialog.vue';
import DangerButton from '@/components/core/buttons/DangerButton.vue';
import GhostButton from '@/components/core/buttons/GhostButton.vue';
import { useBodyStoreStore } from '@/store/core/bodyStore';
import { useNotificationStore } from '@/store/ui/notifications';
import type { BodyStoreView } from '@/data/bodyStores/BodyStoreDto';

/**
 * Deleting a store that still holds stored bodies. Their objects are left
 * exactly where they are — what goes is the platform's record of where they
 * were, so every result that pointed at this store reads "the store was
 * removed" from here on. That is not undoable, so it is confirmed by holding.
 */
const props = defineProps<{
  store: BodyStoreView;
}>();
const emit = defineEmits<{ close: []; forgotten: [] }>();

const { t } = useI18n();
const bodyStoreStore = useBodyStoreStore();
const notifications = useNotificationStore();

const submitting = ref<boolean>(false);
const error = ref<string | null>(null);

async function submit() {
  if (submitting.value) return;
  submitting.value = true;
  error.value = null;
  try {
    const result = await bodyStoreStore.deleteStore(props.store.id, true);
    if (!result.ok) {
      error.value = result.message ?? t('common.states.error');
      return;
    }
    notifications.show(t('bodyStores.deleted'), 'success');
    emit('forgotten');
  } finally {
    submitting.value = false;
  }
}
</script>

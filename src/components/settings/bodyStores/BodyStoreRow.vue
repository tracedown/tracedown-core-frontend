<template>
    <li class="py-2.5 space-y-1">
      <div class="flex items-center gap-3 max-md:flex-wrap">
        <div class="min-w-0 max-md:w-full">
          <p class="text-sm text-text-primary truncate">
            {{ store.name }}
          </p>
          <p class="text-xs text-text-secondary font-mono truncate">
            {{ bodyStoreLocationLabel(store) }}
          </p>
        </div>
        <BadgePill
          class="shrink-0"
          color-class="bg-text-secondary/10 text-text-secondary"
          :label="t(`bodyStores.kinds.${store.kind}`)"
        />
        <BadgePill
          class="shrink-0"
          color-class="bg-accent-primary/10 text-accent-primary"
          :label="t(`bodyStores.modes.${store.mode}`)"
        />
        <span class="text-xs text-text-secondary shrink-0">
          {{ t('bodyStores.agentsCount', { n: store.agents }, store.agents) }}
        </span>
        <div class="flex items-center gap-1 ml-auto shrink-0">
          <SecondaryButton
            :label-text="t('bodyStores.test')"
            :fa-icon="faPlug"
            :loading="testing"
            :on-click="handleTest"
          />
          <template v-if="canManage">
            <IconButton
              :fa-icon="faPen"
              :title="t('common.actions.edit')"
              color-class="text-text-secondary hover:text-accent-primary"
              @click="emit('edit')"
            />
            <IconButton
              :fa-icon="faTrash"
              :title="t('bodyStores.delete')"
              color-class="text-text-secondary hover:text-status-failure"
              :hold-offset-sec="3"
              @safe-click="handleDelete"
            />
          </template>
        </div>
      </div>
      <p
        v-if="testResult"
        class="text-xs"
        :class="testResult.ok ? 'text-status-success' : 'text-status-failure'"
      >
        {{ testResultLabel }}
      </p>
      <p
        v-if="deleteError"
        class="text-xs text-status-failure"
      >
        {{ deleteError }}
      </p>
    </li>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { faPen, faPlug, faTrash } from '@fortawesome/free-solid-svg-icons';
import BadgePill from '@/components/core/BadgePill.vue';
import IconButton from '@/components/core/buttons/IconButton.vue';
import SecondaryButton from '@/components/core/buttons/SecondaryButton.vue';
import { useBodyStoreStore } from '@/store/core/bodyStore';
import { useNotificationStore } from '@/store/ui/notifications';
import { bodyStoreLocationLabel } from '@/data/bodyStores/BodyStoreDto';
import type { BodyStoreSummary, BodyStoreTestResult } from '@/data/bodyStores/BodyStoreDto';

/**
 * One configured body store: where it keeps objects, how bodies are handled,
 * how many agents write to it, and Test / Edit / Delete. Delete is refused by
 * the server while anything still refers to the store; the reason stays on
 * the row, where the operator is looking.
 */
const props = defineProps<{
  store: BodyStoreSummary;
  canManage: boolean;
}>();
const emit = defineEmits<{ edit: [] }>();

const { t } = useI18n();
const bodyStoreStore = useBodyStoreStore();
const notifications = useNotificationStore();

const testing = ref<boolean>(false);
const testResult = ref<BodyStoreTestResult | null>(null);
const deleteError = ref<string | null>(null);

const testResultLabel = computed(() => {
  if (!testResult.value) return '';
  if (testResult.value.ok) return t('bodyStores.testOk');
  return testResult.value.error
    ? t('bodyStores.testFailed', { error: testResult.value.error })
    : t('bodyStores.testFailedGeneric');
});

async function handleTest() {
  if (testing.value) return;
  testing.value = true;
  testResult.value = null;
  try {
    const result = await bodyStoreStore.testStore(props.store.id);
    if (!result.ok || !result.data) {
      notifications.show(result.message ?? t('common.states.error'), 'error');
      return;
    }
    testResult.value = result.data;
  } finally {
    testing.value = false;
  }
}

async function handleDelete() {
  deleteError.value = null;
  const result = await bodyStoreStore.deleteStore(props.store.id);
  if (!result.ok) {
    deleteError.value = result.message ?? t('common.states.error');
    return;
  }
  notifications.show(t('bodyStores.deleted'), 'success');
}
</script>

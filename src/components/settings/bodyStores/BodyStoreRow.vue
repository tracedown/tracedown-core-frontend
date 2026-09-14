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
        <div
          v-if="canManage"
          class="flex items-center gap-1 ml-auto shrink-0"
        >
          <SecondaryButton
            :label-text="t('bodyStores.test')"
            :fa-icon="faPlug"
            :loading="testing"
            :on-click="handleTest"
          />
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
        </div>
      </div>

      <!-- The store's own health: set on any failed read, import or test, and
           cleared by the next success — so a line here is a live problem. -->
      <p
        v-if="store.lastFailure"
        class="text-xs text-status-warning"
      >
        {{ t('bodyStores.lastFailure', {
          reason: failureLabel(store.lastFailure.code),
          when: formatRecentOrDateTime(store.lastFailure.at),
        }) }}
      </p>

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
      <!-- Stored bodies are the one thing moving agents cannot release: the
           only way out is to forget them, which is a decision of its own. -->
      <SecondaryButton
        v-if="canManage && blockedByBodies"
        :label-text="t('bodyStores.forget.action')"
        :on-click="() => forgetOpen = true"
      />

      <BodyStoreForgetDialog
        v-if="forgetOpen"
        :store="store"
        @close="forgetOpen = false"
        @forgotten="forgetOpen = false"
      />
    </li>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { faPen, faPlug, faTrash } from '@fortawesome/free-solid-svg-icons';
import BadgePill from '@/components/core/BadgePill.vue';
import IconButton from '@/components/core/buttons/IconButton.vue';
import SecondaryButton from '@/components/core/buttons/SecondaryButton.vue';
import BodyStoreForgetDialog from '@/components/settings/bodyStores/BodyStoreForgetDialog.vue';
import { useBodyStoreStore } from '@/store/core/bodyStore';
import { useNotificationStore } from '@/store/ui/notifications';
import { useRelativeTime } from '@/composables/useRelativeTime';
import { bodyStoreLocationLabel } from '@/data/bodyStores/BodyStoreDto';
import type { BodyStoreTestResult, BodyStoreUsage, BodyStoreView } from '@/data/bodyStores/BodyStoreDto';

/**
 * One configured body store: where it keeps objects, how bodies are handled,
 * how many agents write to it, its last failure, and Test / Edit / Delete.
 * Delete is refused by the server while anything still refers to the store;
 * the reason stays on the row, where the operator is looking, and names what
 * is holding it.
 */
const props = defineProps<{
  store: BodyStoreView;
  canManage: boolean;
}>();
const emit = defineEmits<{ edit: [] }>();

const { t, te } = useI18n();
const bodyStoreStore = useBodyStoreStore();
const notifications = useNotificationStore();
const { formatRecentOrDateTime } = useRelativeTime();

const testing = ref<boolean>(false);
const testResult = ref<BodyStoreTestResult | null>(null);
const deleteError = ref<string | null>(null);
const blockedByBodies = ref<boolean>(false);
const forgetOpen = ref<boolean>(false);

/** A failure code in words; an unknown code is shown as-is rather than hidden. */
function failureLabel(code: string): string {
  const key = `bodyStores.testCodes.${code}`;
  return te(key) ? t(key) : code;
}

const testResultLabel = computed(() => {
  if (!testResult.value) return '';
  if (testResult.value.ok) return t('bodyStores.testOk');
  // Each probe code is a sentence of its own — "Not reachable: access_denied"
  // told the operator nothing they could act on.
  return testResult.value.error ? failureLabel(testResult.value.error) : t('bodyStores.testFailedGeneric');
});

/** What still holds the store, in words, plus what to do about it. */
function usageMessage(usage: BodyStoreUsage): string | null {
  const parts: string[] = [];
  if (usage.agents > 0) parts.push(t('bodyStores.inUse.agents', { n: usage.agents }, usage.agents));
  if (usage.tokens > 0) parts.push(t('bodyStores.inUse.tokens', { n: usage.tokens }, usage.tokens));
  if (usage.bodies) parts.push(t('bodyStores.inUse.bodies'));
  if (parts.length === 0) return null;
  const what = parts.length === 1
    ? parts[0]
    : `${parts.slice(0, -1).join(', ')} ${t('bodyStores.inUse.and')} ${parts[parts.length - 1]}`;
  const next = usage.bodies ? t('bodyStores.inUse.nextBodies') : t('bodyStores.inUse.next');
  return `${t('bodyStores.inUse.intro', { what })} ${next}`;
}

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
  blockedByBodies.value = false;
  const result = await bodyStoreStore.deleteStore(props.store.id);
  if (!result.ok) {
    const usage = result.code === 'body_store_in_use' ? result.data : undefined;
    deleteError.value = (usage && usageMessage(usage)) ?? result.message ?? t('common.states.error');
    blockedByBodies.value = usage?.bodies ?? false;
    return;
  }
  notifications.show(t('bodyStores.deleted'), 'success');
}
</script>

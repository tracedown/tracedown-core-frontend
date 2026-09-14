<template>
    <div class="space-y-1">
      <p
        v-if="!ready"
        class="text-xs text-text-secondary"
      >
        {{ t('common.states.loading') }}
      </p>
      <template v-else>
        <CopyField
          :value="settings"
          multiline
          :label="t('agents.storage.label')"
        />
        <p
          v-if="note"
          class="text-xs text-text-secondary"
        >
          {{ note }}
        </p>
      </template>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import CopyField from '@/components/common/CopyField.vue';
import { useBodyStoreStore } from '@/store/core/bodyStore';
import { agentBodyTarget, agentStorageVariables } from '@/lib/agentStartup';
import type { BodyStoreSummary } from '@/data/bodyStores/BodyStoreDto';

/**
 * The storage settings one agent has to be (re)started with to write into a
 * given store — the same variables the connect form prints with a bootstrap
 * token, without the bootstrap. Assigning a store only records the assignment:
 * the running agent keeps writing where its own environment says, so this is
 * what has to be applied to it.
 */
const props = defineProps<{
  slug: string;
  /** The store the agent is assigned to; null = the default store. */
  store: BodyStoreSummary | null;
}>();

const { t } = useI18n();
const bodyStoreStore = useBodyStoreStore();

/** The default store's kind is only known once `/body-stores/default` has answered. */
const ready = computed<boolean>(() => props.store !== null || bodyStoreStore.defaultLoaded);

const bodies = computed(() =>
  agentBodyTarget(props.store, bodyStoreStore.defaultStore?.kind === 's3' ? 's3' : 'filesystem', props.slug));

const settings = computed(() =>
  agentStorageVariables(bodies.value).map(([key, value]) => `${key}=${value}`).join('\n'));

const note = computed<string | null>(() => {
  const target = bodies.value;
  if (target.backend === 's3') return target.store ? t('agents.storage.storeS3Note') : t('agents.storage.s3Note');
  if (props.store) return t('agents.storage.storeFilesystemNote', { path: target.dir, root: target.mountPath });
  return null;
});
</script>

<template>
    <ModalDialog
      :modal-name="store ? t('bodyStores.editTitle', { name: store.name }) : t('bodyStores.addTitle')"
      @close="emit('close')"
    >
      <div class="space-y-3 w-lg max-w-full p-2 max-md:p-0">
        <LabeledInput
          v-model="form.name"
          :label="t('bodyStores.fields.name')"
          maxlength="64"
        />

        <div>
          <p class="text-xs text-text-secondary mb-1">
            {{ t('bodyStores.kind') }}
          </p>
          <AppSelect
            v-model="form.kind"
            :options="kindOptions"
          />
        </div>

        <fieldset class="space-y-1">
          <legend class="text-xs text-text-secondary mb-1">
            {{ t('bodyStores.mode') }}
          </legend>
          <label
            v-for="mode in BODY_STORE_MODES"
            :key="mode"
            class="flex items-start gap-2 cursor-pointer py-1"
          >
            <input
              v-model="form.mode"
              type="radio"
              name="body-store-mode"
              :value="mode"
              class="mt-1 accent-accent-primary"
            >
            <span class="min-w-0">
              <span class="block text-sm text-text-primary">{{ t(`bodyStores.modes.${mode}`) }}</span>
              <span class="block text-xs text-text-secondary">{{ t(`bodyStores.modeHints.${mode}`) }}</span>
            </span>
          </label>
        </fieldset>

        <template v-if="form.kind === 's3'">
          <LabeledInput
            v-model="form.endpoint"
            :label="t('bodyStores.fields.endpoint')"
            placeholder="https://"
          />
          <div class="grid grid-cols-2 gap-2 max-md:grid-cols-1">
            <LabeledInput
              v-model="form.bucket"
              :label="t('bodyStores.fields.bucket')"
            />
            <LabeledInput
              v-model="form.region"
              :label="t('bodyStores.fields.region')"
              :placeholder="t('bodyStores.regionPlaceholder')"
            />
          </div>
          <LabeledInput
            v-model="form.prefix"
            :label="t('bodyStores.fields.prefix')"
          />
          <LabeledInput
            v-model="form.accessKeyId"
            :label="t('bodyStores.fields.accessKeyId')"
            autocomplete="off"
          />
          <div>
            <LabeledInput
              v-model="form.secretAccessKey"
              type="password"
              autocomplete="new-password"
              :label="t('bodyStores.fields.secretAccessKey')"
            />
            <p class="text-xs text-text-secondary mt-1">
              {{ store?.hasSecret ? t('bodyStores.secretKeep') : t('bodyStores.secretWriteOnly') }}
            </p>
          </div>
        </template>
        <div v-else>
          <LabeledInput
            v-model="form.rootPath"
            :label="t('bodyStores.fields.rootPath')"
            placeholder="/data/bodies"
          />
          <p class="text-xs text-text-secondary mt-1">
            {{ t('bodyStores.rootPathHint') }}
          </p>
        </div>

        <p
          v-if="error"
          class="text-xs text-status-failure"
        >
          {{ error }}
        </p>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2 px-2 pb-2 max-md:p-0">
          <SecondaryButton
            :label-text="t('common.actions.cancel')"
            :on-click="() => emit('close')"
          />
          <PrimaryButton
            :label-text="store ? t('common.actions.save') : t('common.actions.create')"
            :loading="saving"
            :disabled="!form.name.trim()"
            :on-click="handleSave"
          />
        </div>
      </template>
    </ModalDialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ModalDialog from '@/components/core/ModalDialog.vue';
import LabeledInput from '@/components/core/input/LabeledInput.vue';
import AppSelect from '@/components/core/input/AppSelect.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import SecondaryButton from '@/components/core/buttons/SecondaryButton.vue';
import { useBodyStoreStore } from '@/store/core/bodyStore';
import { useNotificationStore } from '@/store/ui/notifications';
import { BODY_STORE_KINDS, BODY_STORE_MODES } from '@/data/bodyStores/BodyStoreDto';
import type {
  BodyStoreKind, BodyStoreMode, BodyStoreRequest, BodyStoreSummary,
} from '@/data/bodyStores/BodyStoreDto';
import type { SelectOption } from '@/types/ui/common';

/**
 * Add or edit one body store. The secret is write-only: it is never returned,
 * so on edit an empty field means "keep the saved one" and is not sent.
 */
const props = defineProps<{
  /** The store being edited, or null to add one. */
  store: BodyStoreSummary | null;
}>();
const emit = defineEmits<{ close: []; saved: [] }>();

const { t } = useI18n();
const bodyStoreStore = useBodyStoreStore();
const notifications = useNotificationStore();

const form = reactive({
  name: props.store?.name ?? '',
  kind: (props.store?.kind ?? 's3') as string,
  mode: (props.store?.mode ?? 'import') as BodyStoreMode,
  endpoint: props.store?.endpoint ?? '',
  region: props.store?.region ?? '',
  bucket: props.store?.bucket ?? '',
  prefix: props.store?.prefix ?? '',
  rootPath: props.store?.rootPath ?? '',
  accessKeyId: props.store?.accessKeyId ?? '',
  secretAccessKey: '',
});

const saving = ref<boolean>(false);
const error = ref<string | null>(null);

const kindOptions = computed<SelectOption[]>(() =>
  BODY_STORE_KINDS.map(kind => ({ value: kind, label: t(`bodyStores.kinds.${kind}`) })));

/** Only the chosen kind's fields travel; blanks are omitted rather than sent empty. */
function buildRequest(): BodyStoreRequest {
  const kind: BodyStoreKind = form.kind === 'filesystem' ? 'filesystem' : 's3';
  const request: BodyStoreRequest = { name: form.name.trim(), kind, mode: form.mode };
  const set = (
    key: 'endpoint' | 'region' | 'bucket' | 'prefix' | 'rootPath' | 'accessKeyId' | 'secretAccessKey',
    value: string
  ) => {
    const trimmed = value.trim();
    if (trimmed) request[key] = trimmed;
  };
  if (kind === 's3') {
    set('endpoint', form.endpoint);
    set('region', form.region);
    set('bucket', form.bucket);
    set('prefix', form.prefix);
    set('accessKeyId', form.accessKeyId);
    set('secretAccessKey', form.secretAccessKey);
  } else {
    set('rootPath', form.rootPath);
  }
  return request;
}

async function handleSave() {
  if (saving.value) return;
  saving.value = true;
  error.value = null;
  try {
    const request = buildRequest();
    const result = props.store
      ? await bodyStoreStore.updateStore(props.store.id, request)
      : await bodyStoreStore.createStore(request);
    if (!result.ok) {
      error.value = result.code === 'store_field_required' && result.field
        ? t('bodyStores.fieldRequired', { field: fieldLabel(result.field) })
        : (result.message ?? t('common.states.error'));
      return;
    }
    notifications.show(props.store ? t('bodyStores.saved') : t('bodyStores.created'), 'success');
    emit('saved');
  } finally {
    saving.value = false;
  }
}

const FIELD_KEYS = ['name', 'endpoint', 'region', 'bucket', 'prefix', 'rootPath', 'accessKeyId', 'secretAccessKey'];

function fieldLabel(field: string): string {
  return FIELD_KEYS.includes(field) ? t(`bodyStores.fields.${field}`) : field;
}
</script>

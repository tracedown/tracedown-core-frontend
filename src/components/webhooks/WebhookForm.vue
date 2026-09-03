<template>
    <form
      class="space-y-3 max-w-2xl"
      @submit.prevent="handleSubmit"
    >
      <div class="flex items-end gap-2 flex-wrap max-md:flex-col max-md:items-stretch">
        <div>
          <p class="text-xs text-text-secondary mb-1">
            {{ t('webhooks.name') }}
          </p>
          <TextInput
            v-model="name"
            class="w-44"
            compact
            :placeholder="t('webhooks.namePlaceholder')"
          />
        </div>
        <div>
          <p class="text-xs text-text-secondary mb-1">
            {{ t('webhooks.label') }}
          </p>
          <TextInput
            v-model="label"
            class="w-36"
            compact
            :placeholder="t('webhooks.labelPlaceholder')"
          />
        </div>
        <div>
          <p class="text-xs text-text-secondary mb-1">
            {{ t('webhooks.method') }}
          </p>
          <AppSelect
            v-model="method"
            class="w-24"
            :options="METHOD_OPTIONS"
          />
        </div>
        <div>
          <p class="text-xs text-text-secondary mb-1">
            {{ t('webhooks.attempts') }}
          </p>
          <AppSelect
            v-model="attempts"
            class="w-16"
            :options="ATTEMPT_OPTIONS"
          />
        </div>
      </div>

      <div>
        <p class="text-xs text-text-secondary mb-1">
          {{ t('webhooks.url') }}
        </p>
        <TextInput
          v-model="url"
          compact
          class="font-mono"
          placeholder="https://hooks.example.com/tracedown"
        />
        <p class="text-xs text-text-secondary mt-1">
          {{ t('webhooks.urlVarsHint') }}
        </p>
      </div>

      <div v-if="method !== 'GET'">
        <p class="text-xs text-text-secondary mb-1">
          {{ t('webhooks.body') }}
        </p>
        <TextArea
          v-model="body"
          :rows="4"
          :placeholder="BODY_PLACEHOLDER"
        />
        <p
          v-if="body.trim() && !body.includes('${text}')"
          class="text-xs text-status-warning mt-1"
        >
          {{ t('webhooks.bodyNoText') }}
        </p>
        <p
          v-if="body.trim() && !bodyValid"
          class="text-xs text-status-failure mt-1"
        >
          {{ t('webhooks.bodyInvalid') }}
        </p>
      </div>

      <div>
        <p class="text-xs text-text-secondary mb-1">
          {{ t('webhooks.config') }}
        </p>
        <TextArea
          v-model="config"
          :rows="3"
          :placeholder="CONFIG_PLACEHOLDER"
        />
        <p
          v-if="config.trim() && !configValid"
          class="text-xs text-status-failure mt-1"
        >
          {{ t('webhooks.configInvalid') }}
        </p>
      </div>

      <div class="flex items-center gap-2">
        <PrimaryButton
          type="submit"
          :label-text="initial ? t('common.actions.save') : t('common.actions.create')"
          :loading="submitting"
          :disabled="!valid"
        />
        <GhostButton
          :label-text="t('common.actions.cancel')"
          :on-click="() => emit('cancel')"
        />
      </div>
    </form>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import TextInput from '@/components/core/input/TextInput.vue';
import TextArea from '@/components/core/input/TextArea.vue';
import AppSelect from '@/components/core/input/AppSelect.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import GhostButton from '@/components/core/buttons/GhostButton.vue';
import type { CreateWebhookRequest, WebhookSummary } from '@/data/webhooks/WebhookDto';
import type { SelectOption } from '@/types/ui/common';

/**
 * Create/edit form for a webhook delivery channel. The body template must
 * carry `${text}` (the dispatcher's TemplateRenderer injects the rendered
 * notification there — spec says $TEXT but the implementation is `${text}`);
 * `config` holds delivery JSON such as auth headers.
 */
const props = defineProps<{
  /** Existing webhook to edit; omit to create. */
  initial?: WebhookSummary | null;
  submitting?: boolean;
}>();

const emit = defineEmits<{
  submit: [payload: CreateWebhookRequest];
  cancel: [];
}>();

const { t } = useI18n();

const METHOD_OPTIONS: SelectOption[] = ['POST', 'PUT', 'PATCH', 'GET']
  .map(m => ({ value: m, label: m }));
const ATTEMPT_OPTIONS: SelectOption[] = ['1', '2', '3', '5']
  .map(n => ({ value: n, label: n }));

const BODY_PLACEHOLDER = '{"text": "${text}"}';
const CONFIG_PLACEHOLDER = '{"headers": {"Authorization": "Bearer ..."}}';

const name = ref<string>(props.initial?.name ?? '');
const label = ref<string>(props.initial?.label ?? '');
const url = ref<string>(props.initial?.url ?? '');
const method = ref<string>(props.initial?.method ?? 'POST');
const attempts = ref<string>(String(props.initial?.attemptCount ?? 1));
const body = ref<string>(props.initial?.body ?? '');
const config = ref<string>(props.initial?.config ?? '');

const configValid = computed(() => {
  if (!config.value.trim()) return true;
  try {
    JSON.parse(config.value);
    return true;
  } catch {
    return false;
  }
});

// The body column is JSONB — non-JSON templates are rejected by the DB.
const bodyValid = computed(() => {
  if (!body.value.trim()) return true;
  try {
    JSON.parse(body.value);
    return true;
  } catch {
    return false;
  }
});

const valid = computed(() =>
  name.value.trim().length > 0
  && /^https?:\/\//.test(url.value.trim())
  && configValid.value
  && bodyValid.value
  && (method.value === 'GET' || !body.value.trim() || body.value.includes('${text}')));

function handleSubmit() {
  if (!valid.value) return;
  emit('submit', {
    name: name.value.trim(),
    url: url.value.trim(),
    method: method.value,
    label: label.value.trim() || undefined,
    body: method.value === 'GET' ? undefined : (body.value.trim() || undefined),
    config: config.value.trim() || undefined,
    attemptCount: Number(attempts.value),
  });
}
</script>

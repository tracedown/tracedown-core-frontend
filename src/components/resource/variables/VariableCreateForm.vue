<template>
    <div class="mb-6 p-4  border-b border-text-secondary/50">
      <!-- Wrapping row of uniform h-8 controls: in narrow hosts (service panel)
           the type/buttons drop to the next line instead of squeezing the fields. -->
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex-1 min-w-40">
          <label class="block text-xs font-medium text-text-secondary mb-1">{{ t('common.labels.key') }}</label>
          <TextInput
            v-model="key"
            compact
            class="font-mono"
            :prefix="resourcePrefix"
            :placeholder="t('variables.keyPlaceholder')"
          />
        </div>
        <div class="flex-1 min-w-40">
          <label class="block text-xs font-medium text-text-secondary mb-1">{{ t('common.labels.value') }}</label>
          <TextInput
            v-model="value"
            compact
            :placeholder="t('common.labels.value')"
          />
        </div>
        <div class="w-36">
          <div class="flex items-center gap-1.5 mb-1">
            <label class="block text-xs font-medium text-text-secondary">{{ t('common.labels.type') }}</label>
            <HelpTooltip :entries="typeHelp" />
          </div>
          <AppSelect
            v-model="type"
            :options="typeOptions"
          />
        </div>
        <PrimaryButton
          :label-text="t('common.actions.create')"
          :disabled="!key.trim() || !value.trim()"
          :on-click="submit"
        />
      </div>
      <p
        v-if="type === 'secret'"
        class="mt-3 rounded-sm border border-status-warning/40 bg-status-warning/10 px-3 py-2 text-xs text-status-warning"
      >
        {{ t('variables.secretExposureNotice') }}
      </p>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import AppSelect from '@/components/core/input/AppSelect.vue';
import TextInput from '@/components/core/input/TextInput.vue';
import HelpTooltip from '@/components/core/HelpTooltip.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import type { CreateVariableRequest, VariableType } from '@/data/variables/VariableDto';
import type { HelpEntry } from '@/types/ui/help';
import type { SelectOption } from '@/types/ui/common';

const props = withDefaults(defineProps<{
  /** Key prefix of the owning resource, e.g. `$p.` for projects. */
  resourcePrefix: string;
  /** Offered types; scopes without metric writeback pass a narrower set. */
  types?: VariableType[];
}>(), {
  types: () => ['variable', 'secret', 'metric'],
});

// Dismissal is owned by the header's CreateToggleButton — no cancel here.
const emit = defineEmits<{
  create: [request: CreateVariableRequest];
}>();

const { t } = useI18n();

const key = ref<string>('');
const value = ref<string>('');
// String-typed for the select's v-model; narrowed back on submit.
const type = ref<string>('variable');

const typeOptions = computed<SelectOption[]>(() => [
  { value: 'variable', label: t('variables.typeVariable') },
  { value: 'secret', label: t('variables.typeSecret') },
  { value: 'metric', label: t('variables.typeMetric') },
].filter(o => props.types.includes(o.value as VariableType)));

const typeHelp = computed<HelpEntry[]>(() => [
  { term: t('variables.typeSecret'), description: t('variables.typeSecretHelp'), type: 'secret' },
  { term: t('variables.typeVariable'), description: t('variables.typeVariableHelp'), type: 'variable' },
  { term: t('variables.typeMetric'), description: t('variables.typeMetricHelp'), type: 'metric' },
].filter(e => props.types.includes(e.type as VariableType))
  .map(({ term, description }) => ({ term, description })));

function submit() {
  emit('create', {
    key: key.value.trim(),
    value: value.value.trim(),
    type: type.value as VariableType,
  });
}
</script>

<template>
    <div class="mt-4 border-t border-text-secondary/15 pt-3 max-w-2xl">
      <div class="flex items-center justify-between mb-1">
        <h3 class="text-sm font-medium text-text-primary">
          {{ t('webhooks.variablesTitle') }}
        </h3>
        <CreateToggleButton
          v-if="canEdit"
          v-model="showCreateForm"
          :label-text="t('variables.createNew')"
        />
      </div>
      <p class="text-xs text-text-secondary mb-3">
        {{ t('webhooks.variablesHint') }}
      </p>

      <VariableCreateForm
        v-if="showCreateForm"
        :resource-prefix="PREFIX"
        :types="['variable', 'secret']"
        @create="handleCreate"
      />

      <EmptyState
        v-if="variables.length === 0"
        compact
        :icon="faKey"
        :message="t('variables.noVariables')"
      />

      <table
        v-else
        class="w-full table-fixed"
      >
        <thead>
          <tr class="border-b border-text-secondary/50">
            <th class="text-left text-xs font-medium text-text-secondary uppercase tracking-wider py-2 px-3 w-1/3">
              {{ t('common.labels.key') }}
            </th>
            <th class="text-left text-xs font-medium text-text-secondary uppercase tracking-wider py-2 px-3 w-1/3">
              {{ t('common.labels.value') }}
            </th>
            <th class="text-left text-xs font-medium text-text-secondary uppercase tracking-wider py-2 px-3 w-24">
              {{ t('common.labels.type') }}
            </th>
            <th
              v-if="canEdit"
              class="w-20"
            />
          </tr>
        </thead>
        <tbody>
          <VariableRow
            v-for="variable in variables"
            :key="variable.id"
            :variable="variable"
            :resource-prefix="PREFIX"
            :can-edit="canEdit"
            :revealed-value="store.revealedValues.get(variable.id)"
            @save="actions.handleSave"
            @delete="actions.handleDelete"
            @toggle="actions.handleToggle"
            @reveal="actions.handleReveal"
            @hide="store.hideValue"
          />
        </tbody>
      </table>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { faKey } from '@fortawesome/free-solid-svg-icons';
import CreateToggleButton from '@/components/core/buttons/CreateToggleButton.vue';
import VariableCreateForm from '@/components/resource/variables/VariableCreateForm.vue';
import VariableRow from '@/components/resource/variables/VariableRow.vue';
import EmptyState from '@/components/core/EmptyState.vue';
import { useWebhookVariableStore } from '@/store/core/webhookVariable';
import { useVariableActions } from '@/composables/useVariableActions';
import type { CreateVariableRequest, VariableSummary } from '@/data/variables/VariableDto';

/**
 * Variables belonging to a single webhook (`$h.` prefix), usable in its URL
 * and config header/query values. Resolved only at delivery, so a credential
 * stored here never becomes an org-wide variable that probe scripts can use.
 * No metric type — there is no writeback at this scope.
 */
const props = defineProps<{
  webhookId: string;
  canEdit: boolean;
}>();

const { t } = useI18n();
const store = useWebhookVariableStore();

const PREFIX = '$h.';
const showCreateForm = ref<boolean>(false);

const variables = computed<VariableSummary[]>(() => store.variablesByWebhook.get(props.webhookId) ?? []);

const actions = useVariableActions({
  create: request => store.createVariable(props.webhookId, request),
  update: (variableId, value) => store.updateVariable(props.webhookId, variableId, value),
  remove: variableId => store.deleteVariable(props.webhookId, variableId),
  reveal: variableId => store.revealVariable(props.webhookId, variableId),
});

async function handleCreate(request: CreateVariableRequest) {
  if (await actions.handleCreate(request)) showCreateForm.value = false;
}

onMounted(() => {
  void store.fetchVariables(props.webhookId);
});
</script>

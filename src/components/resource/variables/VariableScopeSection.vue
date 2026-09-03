<template>
    <div class="border border-text-secondary/20 rounded-md mb-3">
      <!-- Collapsible header -->
      <button
        type="button"
        class="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors
             hover:bg-background-secondary/50 max-md:flex-wrap"
        @click="open = !open"
      >
        <FontAwesomeIcon
          :icon="open ? faChevronDown : faChevronRight"
          class="w-3 h-3 text-text-secondary shrink-0"
        />
        <span class="text-sm font-medium text-text-primary truncate">{{ scope.resourceName }}</span>
        <BadgePill
          class="shrink-0"
          color-class="bg-text-secondary/15 text-text-secondary font-mono"
          :label="scope.prefix"
        />
        <span
          v-if="!scope.editable"
          class="text-xs text-text-secondary shrink-0"
        >{{ t('variables.inherited') }}</span>
        <span class="ml-auto text-xs text-text-secondary shrink-0">{{ countLabel }}</span>
      </button>

      <!-- Body -->
      <div
        v-show="open"
        class="px-3 pb-3"
      >
        <div
          v-if="scope.editable && canEdit"
          class="flex justify-end mb-2"
        >
          <CreateToggleButton
            v-model="showCreate"
            :label-text="t('variables.createNew')"
          />
        </div>

        <VariableCreateForm
          v-if="showCreate && scope.editable && canEdit"
          :resource-prefix="scope.prefix"
          @create="handleCreate"
        />

        <EmptyState
          v-if="isEmpty"
          compact
          :icon="faKey"
          :message="t('variables.noVariables')"
        />

        <VariableTable
          v-else
          :variables="scope.variables"
          :locked="scope.locked"
          :resource-prefix="scope.prefix"
          :can-edit="actionsColumn"
          :readonly="!scope.editable"
          :revealed-values="revealedValues"
          @save="(id, value) => emit('save', id, value)"
          @delete="(id) => emit('delete', id)"
          @toggle="(v) => emit('toggle', v)"
          @reveal="(id) => emit('reveal', id)"
          @hide="(id) => emit('hide', id)"
        />
      </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faChevronDown, faChevronRight, faKey } from '@fortawesome/free-solid-svg-icons';
import BadgePill from '@/components/core/BadgePill.vue';
import EmptyState from '@/components/core/EmptyState.vue';
import CreateToggleButton from '@/components/core/buttons/CreateToggleButton.vue';
import VariableCreateForm from '@/components/resource/variables/VariableCreateForm.vue';
import VariableTable from '@/components/resource/variables/VariableTable.vue';
import type { CreateVariableRequest, VariableScope, VariableSummary } from '@/data/variables/VariableDto';

/**
 * One scope layer of the variables hierarchy, collapsible. The editable scope
 * (the resource being viewed) allows create/edit/delete; inherited ancestor
 * scopes are read-only context. Locked computed variables render at the top of
 * every scope.
 */
const props = defineProps<{
  scope: VariableScope;
  canEdit: boolean;
  defaultOpen: boolean;
  revealedValues: Map<string, string>;
}>();

const emit = defineEmits<{
  create: [request: CreateVariableRequest, done: (ok: boolean) => void];
  save: [variableId: string, value: string];
  delete: [variableId: string];
  toggle: [variable: VariableSummary];
  reveal: [variableId: string];
  hide: [variableId: string];
}>();

const { t } = useI18n();

const open = ref<boolean>(props.defaultOpen);
const showCreate = ref<boolean>(false);

/**
 * On success the form unmounts (and thereby resets) so a second submit can't
 * duplicate the variable; on failure it stays open with its input intact.
 */
function handleCreate(request: CreateVariableRequest) {
  emit('create', request, (ok) => {
    if (ok) showCreate.value = false;
  });
}

/** Actions column present only where rows are editable. */
const actionsColumn = computed<boolean>(() => props.scope.editable && props.canEdit);

const isEmpty = computed<boolean>(() =>
  props.scope.variables.length === 0 && props.scope.locked.length === 0);

const countLabel = computed<string>(() =>
  t('variables.scopeCount', { n: props.scope.variables.length + props.scope.locked.length }));
</script>

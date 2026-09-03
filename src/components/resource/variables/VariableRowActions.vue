<template>
    <div class="flex items-center justify-end gap-1">
      <IconButton
        v-if="!editing"
        :fa-icon="faPenToSquare"
        :title="t('common.actions.edit')"
        @click="emit('edit')"
      />
      <IconButton
        :fa-icon="faTrash"
        :title="t('common.actions.delete')"
        color-class="text-text-secondary hover:text-status-failure"
        :hold-offset-sec="3"
        @safe-click="emit('delete')"
      />
    </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { faPenToSquare, faTrash } from '@fortawesome/free-solid-svg-icons';
import IconButton from '@/components/core/buttons/IconButton.vue';

/** Edit + hold-to-delete pair of one editable variable row. */
defineProps<{
  /** Hides the pencil while the value cell is already in edit mode. */
  editing: boolean;
}>();

const emit = defineEmits<{
  edit: [];
  delete: [];
}>();

const { t } = useI18n();
</script>

<template>
    <div class="space-y-4 max-w-2xl">
      <form
        class="space-y-3"
        @submit.prevent="handleSave"
      >
        <div>
          <p class="text-xs text-text-secondary mb-1">
            {{ t('templates.name') }}
          </p>
          <TextInput
            v-model="name"
            class="w-64"
            compact
          />
        </div>
        <div>
          <p class="text-xs text-text-secondary mb-1">
            {{ t('templates.text') }}
          </p>
          <TextArea
            v-model="text"
            :rows="3"
          />
          <p class="text-xs text-text-secondary mt-1">
            {{ t('templates.varsHint') }}
          </p>
        </div>
        <PrimaryButton
          type="submit"
          :label-text="t('common.actions.save')"
          :loading="saving"
          :disabled="!name.trim() || !text.trim()"
        />
      </form>

      <PillPicker
        :title="t('templates.boundProjects')"
        :available="availableProjects"
        :assigned="assignedProjects"
        :search-placeholder="t('templates.searchProjects')"
        :add-title="t('templates.bind')"
        :remove-title="t('templates.unbind')"
        :all-assigned-text="t('templates.allBound')"
        :none-assigned-text="t('templates.noneBound')"
        @add="(id: string) => emit('bind', id)"
        @remove="(id: string) => emit('unbind', id)"
      />
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import TextInput from '@/components/core/input/TextInput.vue';
import TextArea from '@/components/core/input/TextArea.vue';
import PillPicker from '@/components/core/PillPicker.vue';
import { useNotificationTemplateStore } from '@/store/core/notificationTemplate';
import { useNotificationStore } from '@/store/ui/notifications';
import type { PillItem } from '@/types/ui/common';
import type { NotificationTemplateSummary } from '@/data/notifications/NotificationTemplateDto';
import type { ProjectSummary } from '@/data/projects/ProjectDto';

/**
 * The expanded panel of one template row: edit form + project bindings.
 * Plain content, not a `<td>` — the list around it is a `ResponsiveTable`,
 * which renders a real table on desktop and stacked cards on a phone.
 */
const props = defineProps<{
  template: NotificationTemplateSummary;
  /** Org-wide project options for the binding picker. */
  projects: ProjectSummary[];
}>();

const emit = defineEmits<{
  toggle: [];
  bind: [projectId: string];
  unbind: [projectId: string];
}>();

const { t } = useI18n();
const templateStore = useNotificationTemplateStore();
const notifications = useNotificationStore();

const name = ref<string>(props.template.name);
const text = ref<string>(props.template.text);
const saving = ref<boolean>(false);

const availableProjects = computed<PillItem[]>(() => {
  const bound = new Set(props.template.projectIds);
  return props.projects
    .filter(p => !bound.has(p.id))
    .map(p => ({ id: p.id, label: p.name }));
});

const assignedProjects = computed<PillItem[]>(() =>
  props.template.projectIds.map(id => ({
    id,
    label: props.projects.find(p => p.id === id)?.name ?? id,
  })));

async function handleSave() {
  if (saving.value) return;
  saving.value = true;
  try {
    const result = await templateStore.updateTemplate(props.template.id, {
      name: name.value.trim(),
      text: text.value.trim(),
    });
    if (!result.ok) {
      notifications.show(result.message ?? t('common.states.error'), 'error');
      return;
    }
    emit('toggle');
  } finally {
    saving.value = false;
  }
}
</script>

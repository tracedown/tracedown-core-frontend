<template>
    <!--  Desktop: the editor inline, exactly where it has always been.  -->
    <div
      v-if="!isMobile"
      class="group relative"
    >
      <component
        :is="ScriptEditor"
        v-model="model"
        :readonly="readonly"
        :min-height="minHeight"
        :max-height="maxHeight"
        :service-name="serviceName"
        :collab-id="collabId"
        @validate="(count: number) => emit('validate', count)"
      />
      <!-- Floating editor actions — dimmed at rest, full opacity on hover. -->
      <div
        v-if="$slots.actions"
        class="absolute top-2 right-2 z-10 flex flex-col gap-1 rounded
               bg-background-secondary/70 backdrop-blur-sm p-1
               opacity-50 transition-opacity group-hover:opacity-100"
      >
        <slot name="actions" />
      </div>
    </div>

    <!--  Mobile: a read-only preview and a launcher. A code editor inside a
          scrolling form on a phone fights the page for every gesture, so the
          real editing surface is the full-screen sheet below.  -->
    <div
      v-else
      class="border border-text-secondary/50"
    >
      <pre
        v-if="preview"
        class="px-3 py-2 text-xs font-mono leading-relaxed text-text-secondary
               whitespace-pre overflow-x-auto no-scrollbar"
      >{{ preview }}</pre>
      <p
        v-else
        class="px-3 py-3 text-xs text-text-secondary italic"
      >
        {{ t('editor.emptyScript') }}
      </p>
      <div class="flex items-center gap-2 px-3 py-2 border-t border-text-secondary/25">
        <PrimaryButton
          :label-text="readonly ? t('editor.viewScript') : t('editor.editScript')"
          :fa-icon="faPenToSquare"
          :on-click="openEditor"
        />
        <span
          v-if="hiddenLines > 0"
          class="text-xs text-text-secondary"
        >
          {{ t('editor.moreLines', { count: hiddenLines }) }}
        </span>
        <div
          v-if="$slots.actions"
          class="ml-auto flex items-center gap-1"
        >
          <slot name="actions" />
        </div>
      </div>
    </div>

    <!--  The sheet hosts the SAME editor component the registry resolves, so a
          host that replaced the editor gets its own editor here too.  -->
    <ModalDialog
      v-if="sheetOpen"
      :modal-name="title"
      persistent
      @close="cancel"
    >
      <component
        :is="ScriptEditor"
        v-model="draft"
        :readonly="readonly"
        :min-height="SHEET_EDITOR_HEIGHT"
        :service-name="serviceName"
        :collab-id="collabId"
        @validate="(count: number) => draftErrors = count"
      />
      <template #footer>
        <div class="flex items-center gap-2">
          <PrimaryButton
            v-if="!readonly"
            :label-text="t('common.actions.save')"
            :on-click="commit"
          />
          <GhostButton
            :label-text="readonly ? t('common.actions.close') : t('common.actions.cancel')"
            :on-click="cancel"
          />
          <span
            v-if="!readonly && draftErrors > 0"
            class="text-xs text-status-failure"
          >
            {{ t('service.hasErrors') }}
          </span>
        </div>
      </template>
    </ModalDialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { faPenToSquare } from '@fortawesome/free-solid-svg-icons';
import ModalDialog from '@/components/core/ModalDialog.vue';
import GhostButton from '@/components/core/buttons/GhostButton.vue';
import PrimaryButton from '@/components/core/buttons/PrimaryButton.vue';
import { getScriptEditor } from '@/config/extensions';
import { useViewport } from '@/composables/useViewport';

/**
 * The one place the app mounts a probe-script editor.
 *
 * It resolves the editor from the extension registry (`getScriptEditor()`), so
 * a host that swapped the built-in CodeMirror editor for its own gets that
 * editor in both presentations — inline on desktop, and inside the full-screen
 * sheet on mobile — with no host-side change. Never call `getScriptEditor()`
 * from a view; render this instead.
 */
const props = withDefaults(
  defineProps<{
    /** Heading of the mobile sheet. Already translated. */
    title: string;
    readonly?: boolean;
    minHeight?: string;
    maxHeight?: string;
    /** Names the file when the editor's save shortcut downloads the script. */
    serviceName?: string;
    /** Service id — enables live collaborative editing when set. */
    collabId?: string;
    /** Lines of the mobile preview before "+N more". */
    previewLines?: number;
  }>(),
  {
    readonly: false,
    minHeight: undefined,
    maxHeight: undefined,
    serviceName: undefined,
    collabId: undefined,
    previewLines: 10,
  }
);

const model = defineModel<string>({ required: true });

const emit = defineEmits<{
  validate: [errorCount: number];
}>();

const { t } = useI18n();
const { isMobile } = useViewport();

const ScriptEditor = getScriptEditor();

/**
 * Height of the editor inside the sheet: the viewport less the sticky header
 * and footer, so the editing surface fills what is left instead of floating in
 * a half-empty sheet.
 */
const SHEET_EDITOR_HEIGHT = 'calc(100dvh - 7.5rem)';

const sheetOpen = ref<boolean>(false);
const draft = ref<string>('');
const draftErrors = ref<number>(0);

const lines = computed(() => model.value.split('\n'));
const preview = computed(() => lines.value.slice(0, props.previewLines).join('\n').trimEnd());
const hiddenLines = computed(() => Math.max(0, lines.value.length - props.previewLines));

function openEditor() {
  draft.value = model.value;
  draftErrors.value = 0;
  sheetOpen.value = true;
}

function commit() {
  model.value = draft.value;
  sheetOpen.value = false;
  emit('validate', draftErrors.value);
}

/**
 * Discarding the draft also discards what the editor said about it — the
 * committed script was never the thing being validated, so reporting zero
 * errors leaves the decision to the server rather than blocking a save on a
 * verdict about text the user threw away.
 */
function cancel() {
  sheetOpen.value = false;
  emit('validate', 0);
}
</script>

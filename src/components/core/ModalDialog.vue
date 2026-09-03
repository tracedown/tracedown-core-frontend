<template>
    <Teleport to="body">
      <div
        class="fixed top-0 left-0 z-999
               bg-black/50 flex justify-center
               items-center backdrop-blur-sm backdrop-brightness-75"
        :class="isMobile ? 'w-full h-dvh' : 'full'"
        @click="onBackdropClick"
        @wheel.prevent
        @touchmove.prevent
      >
        <div
          class="bg-background-secondary relative shadow-xl"
          :class="panelClass"
          @click.stop
          @wheel.stop
          @touchmove.stop
        >
          <div
            class="flex justify-between items-center bg-background-secondary z-10"
            :class="isMobile
              ? 'shrink-0 px-4 py-3 border-b border-text-secondary/25'
              : 'sticky top-0 p-2 rounded'"
          >
            <div class="text-text-primary font-bold text-lg truncate">
              {{ modalName }}
            </div>
            <div
              class="cursor-pointer p-1 bg-background-primary rounded-lg shrink-0"
              @click="emit('close')"
            >
              <FontAwesomeIcon
                :icon="faXmark"
                class="h-5 select-none"
              />
            </div>
          </div>

          <!--  Body. On a phone the panel is the viewport and only this
                scrolls, so the header and the action footer stay reachable
                with the keyboard up.  -->
          <div :class="isMobile ? 'flex-1 min-h-0 overflow-y-auto px-4 py-3' : ''">
            <slot />
          </div>

          <div
            v-if="$slots.footer"
            :class="isMobile
              ? 'shrink-0 px-4 py-3 border-t border-text-secondary/25 bg-background-secondary'
              : 'pt-3'"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { useBodyScrollLock } from '@/composables/useBodyScrollLock';
import { useViewport } from '@/composables/useViewport';

/**
 * Centred dialog on desktop; a full-screen sheet below the mobile breakpoint,
 * where a centred box with a hairline of backdrop around it is just a smaller,
 * harder-to-hit version of the page. The sheet fills the viewport, scrolls its
 * body only, and keeps the header (with the close control) and the optional
 * `#footer` (actions) pinned.
 */
const props = withDefaults(
  defineProps<{
    modalName: string;
    wide?: boolean;
    persistent?: boolean;
  }>(),
  {
    wide: false,
    persistent: false,
  }
);

const emit = defineEmits(['close']);

const { isMobile } = useViewport();

const panelClass = computed(() => {
  if (isMobile.value) {
    return 'w-full h-full max-w-none rounded-none flex flex-col';
  }
  // Same class string the dialog has always emitted on desktop, `wide`
  // included — the cascade decides between the two max-widths exactly as before.
  const base = 'max-w-4xl w-full max-h-4/5 overflow-y-auto p-5 rounded-lg';
  return props.wide ? `${base} max-w-6/10` : base;
});

const onBackdropClick = () => {
  if (!props.persistent) {
    emit('close');
  }
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && !props.persistent) {
    emit('close');
  }
};

// Reference-counted so a dialog opened from inside another overlay (the nav
// drawer, a select sheet) does not hand page scrolling back on close.
useBodyScrollLock();

onMounted(() => document.addEventListener('keydown', onKeydown));
onUnmounted(() => document.removeEventListener('keydown', onKeydown));
</script>

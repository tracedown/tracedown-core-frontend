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
          ref="panel"
          class="bg-background-secondary relative shadow-xl outline-none"
          :class="panelClass"
          tabindex="-1"
          role="dialog"
          aria-modal="true"
          :aria-label="modalName"
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
                width-auto
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
import { computed, nextTick, onMounted, onUnmounted, useTemplateRef } from 'vue';
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

const panel = useTemplateRef<HTMLElement>('panel');

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), '
  + 'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** What Tab can reach inside the panel, in document order. */
function focusables(): HTMLElement[] {
  if (!panel.value) return [];
  return [...panel.value.querySelectorAll<HTMLElement>(FOCUSABLE)]
    .filter(el => el.getClientRects().length > 0 || el === document.activeElement);
}

/**
 * Keeps Tab and Shift+Tab inside the dialog: past the last control focus wraps
 * to the first, and back from the first to the last. Focus that has escaped
 * the panel (a click on the backdrop, say) is brought back on the next Tab.
 */
function trapTab(event: KeyboardEvent) {
  const items = focusables();
  if (items.length === 0) {
    event.preventDefault();
    panel.value?.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  const inside = active instanceof Node && panel.value?.contains(active);
  if (event.shiftKey && (active === first || !inside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !inside)) {
    event.preventDefault();
    first.focus();
  }
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Tab') {
    trapTab(event);
    return;
  }
  if (event.key === 'Escape' && !props.persistent) {
    emit('close');
  }
};

/** Whatever had focus when the dialog opened gets it back when it closes. */
let opener: HTMLElement | null = null;

// Reference-counted so a dialog opened from inside another overlay (the nav
// drawer, a select sheet) does not hand page scrolling back on close.
useBodyScrollLock();

onMounted(() => {
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  document.addEventListener('keydown', onKeydown);
  // Move focus into the dialog unless its content already took it.
  void nextTick(() => {
    const active = document.activeElement;
    if (!(active instanceof Node && panel.value?.contains(active))) panel.value?.focus();
  });
});
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown);
  if (opener?.isConnected) opener.focus();
});
</script>

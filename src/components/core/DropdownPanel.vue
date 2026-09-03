<template>
    <div
      ref="root"
      class="relative"
    >
      <slot
        name="trigger"
        :open="open"
        :toggle="toggle"
      />

      <!--  Desktop: an anchored popover next to the trigger.  -->
      <div
        v-if="open && !isMobile"
        ref="panel"
        class="absolute top-full mt-1 py-1 z-50
             bg-background-secondary border border-text-secondary/50 rounded-lg shadow-xl"
        :class="[alignRight ? 'right-0' : 'left-0', panelClass]"
      >
        <slot :close="close" />
      </div>

      <!--  Mobile: a bottom sheet. An anchored panel of a fixed width sits
            wherever its trigger happens to be, which on a 390px screen means
            half of it hangs off the edge and the options under the fold are
            unreachable. The sheet is always full-width, always thumb-height,
            and scrolls.  -->
      <Teleport
        v-if="open && isMobile"
        to="body"
      >
        <div
          class="fixed inset-0 z-1000 bg-black/50"
          @click="close"
        />
        <div
          ref="panel"
          class="fixed inset-x-0 bottom-0 z-1000 py-2 max-h-[70dvh] overflow-y-auto
               bg-background-secondary border-t border-text-secondary/50 rounded-t-2xl shadow-xl"
        >
          <slot :close="close" />
        </div>
      </Teleport>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useBodyScrollLock } from '@/composables/useBodyScrollLock';
import { useViewport } from '@/composables/useViewport';

/**
 * Generic dropdown shell: a trigger slot toggles a panel, and any click
 * outside the component closes it. Used by selects and the header menus.
 *
 * Below the mobile breakpoint the panel becomes a bottom sheet teleported to
 * the body, so it can never be clipped by the viewport or by an ancestor's
 * overflow. `panelClass` and `alignRight` only apply to the desktop popover —
 * the sheet is always full-width.
 */
withDefaults(
  defineProps<{
    alignRight?: boolean;
    panelClass?: string;
  }>(),
  {
    alignRight: false,
    panelClass: 'w-56',
  }
);

const emit = defineEmits<{
  /** Fired whenever the panel closes (select, toggle, or outside click). */
  closed: [];
}>();

const root = ref<HTMLElement | null>(null);
/** The open panel — teleported out of `root` in sheet mode, so tracked separately. */
const panel = ref<HTMLElement | null>(null);
const open = ref<boolean>(false);

const { isMobile } = useViewport();

// The sheet covers the page; the page behind it must not scroll under it.
useBodyScrollLock(computed(() => open.value && isMobile.value));

function toggle() {
  open.value = !open.value;
  if (!open.value) emit('closed');
}

function close() {
  if (!open.value) return;
  open.value = false;
  emit('closed');
}

/**
 * Containment is tested on `pointerdown`, not `click`: a handler inside the panel
 * may re-render and detach the very element that was clicked (a button that swaps
 * itself for an input, say) before the click bubbles up here — `contains()` would
 * then report false for the detached target and close the panel spuriously. At
 * pointerdown time the DOM is still untouched, so the check is accurate and
 * in-panel controls need no `@click.stop`.
 *
 * In sheet mode the panel is no longer a descendant of `root`, so it is checked
 * on its own; the sheet's own backdrop is what closes it.
 */
function handlePressOutside(e: PointerEvent) {
  if (!open.value) return;
  const target = e.target as Node;
  if (root.value?.contains(target)) return;
  if (panel.value?.contains(target)) return;
  open.value = false;
  emit('closed');
}

onMounted(() => document.addEventListener('pointerdown', handlePressOutside));
onUnmounted(() => document.removeEventListener('pointerdown', handlePressOutside));
</script>

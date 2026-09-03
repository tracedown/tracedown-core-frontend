import { onScopeDispose, watch, type WatchSource } from 'vue';

/**
 * Reference-counted page scroll lock.
 *
 * Overlays stack — a select sheet opens on top of a modal, a modal opens from
 * inside the navigation drawer — and each one wants the page behind it frozen.
 * A naive save/restore per overlay unlocks the page as soon as the *innermost*
 * one closes, so the count lives here and the original inline styles are only
 * restored when the last holder lets go.
 */
let holders = 0;
let previousBodyOverflow = '';
let previousHtmlOverflow = '';

export function lockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  holders += 1;
  if (holders > 1) return;
  previousBodyOverflow = document.body.style.overflow;
  previousHtmlOverflow = document.documentElement.style.overflow;
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
}

export function unlockBodyScroll(): void {
  if (typeof document === 'undefined' || holders === 0) return;
  holders -= 1;
  if (holders > 0) return;
  document.body.style.overflow = previousBodyOverflow;
  document.documentElement.style.overflow = previousHtmlOverflow;
}

/**
 * Holds the lock for as long as `active` is true, releasing it on unmount.
 * Pass nothing to hold it for the component's whole lifetime.
 */
export function useBodyScrollLock(active?: WatchSource<boolean>): void {
  let held = false;

  const apply = (on: boolean) => {
    if (on === held) return;
    held = on;
    if (on) lockBodyScroll();
    else unlockBodyScroll();
  };

  if (active) {
    watch(active, apply, { immediate: true });
  } else {
    apply(true);
  }

  onScopeDispose(() => apply(false));
}

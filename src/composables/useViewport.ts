import { computed, getCurrentScope, onScopeDispose, ref, type ComputedRef } from 'vue';

/**
 * The single breakpoint that separates the mobile shell from the desktop
 * layout. Everything below it gets the phone shell (top bar + drawer, sheets,
 * stacked tables); everything at or above it renders exactly as it always has.
 *
 * 767px is one pixel under Tailwind's `md` (48rem / 768px), so `max-md:*`
 * utilities in templates and this composable always agree — never introduce a
 * second breakpoint for layout decisions.
 */
export const MOBILE_MAX_WIDTH_PX = 767;

/** The media query behind `isMobile`. Exported so tests can stub the same string. */
export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_MAX_WIDTH_PX}px)`;

/**
 * One shared state + one shared listener for the whole app: every consumer
 * reads the same ref, so a viewport change flips the entire shell in a single
 * tick and there is never a frame where the top bar and the sidebar disagree.
 */
const matches = ref<boolean>(false);

let query: MediaQueryList | null = null;
let consumers = 0;

function onChange(event: MediaQueryListEvent): void {
  matches.value = event.matches;
}

/**
 * Attaches the listener on first use. Without `window.matchMedia` (SSR, a
 * jsdom-less unit test) the ref simply stays false — desktop layout — rather
 * than throwing at import time.
 */
function ensureQuery(): void {
  if (query) return;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  query = window.matchMedia(MOBILE_MEDIA_QUERY);
  matches.value = query.matches;
  query.addEventListener('change', onChange);
}

function release(): void {
  consumers -= 1;
  if (consumers > 0 || !query) return;
  query.removeEventListener('change', onChange);
  query = null;
}

/**
 * Reactive viewport class. Call at setup top level:
 *
 * ```ts
 * const { isMobile } = useViewport();
 * ```
 *
 * The listener is reference-counted against the calling effect scope and torn
 * down when the last consumer unmounts. Called outside a scope (a module-level
 * helper) it still returns a live ref, it just never releases.
 */
export function useViewport(): { isMobile: ComputedRef<boolean> } {
  ensureQuery();
  if (getCurrentScope()) {
    consumers += 1;
    onScopeDispose(release);
  }
  return { isMobile: computed(() => matches.value) };
}

import { onMounted, onUnmounted, toValue, type MaybeRefOrGetter } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';

/**
 * Keeps the user on the page while `active`: in-app navigation asks
 * `holdBack()` (which may explain itself) and is cancelled when it answers
 * true; closing or reloading the tab gets the browser's own "leave site?"
 * prompt. Call at setup top level inside a routed view.
 */
export function useLeaveGuard(holdBack: () => boolean, active: MaybeRefOrGetter<boolean>): void {
  onBeforeRouteLeave(() => !holdBack());

  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (!toValue(active)) return;
    event.preventDefault();
    // Older browsers only prompt when returnValue is set.
    event.returnValue = '';
  }

  onMounted(() => window.addEventListener('beforeunload', onBeforeUnload));
  onUnmounted(() => window.removeEventListener('beforeunload', onBeforeUnload));
}

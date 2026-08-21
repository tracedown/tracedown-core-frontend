import { computed, onBeforeUnmount, ref } from 'vue';

/**
 * Press-and-hold gating for destructive actions, shared by the buttons that
 * offer it (`TDButton`, `IconButton`) so the gesture behaves identically
 * wherever it appears.
 *
 * The part worth stating plainly is how a released press is read:
 *
 * - **A click** — pressed and let go straight away — is someone who did not
 *   know the button had to be held. They get a hint saying so.
 * - **A hold that was let go** — any press that lasted beyond a click — is
 *   someone who started the action and thought better of it. That is a
 *   decision, not a mistake, so it passes in silence.
 * - **Leaving the button** (dragging off) is likewise deliberate, and never
 *   hints.
 *
 * The line between the two is [CLICK_MS]: a mouse click runs about 50–150 ms,
 * while noticing a progress ring and letting go takes far longer.
 */
const CLICK_MS = 250;

/** How long the hint stays up before fading out of the way. */
const HINT_MS = 3200;

/** Resolution of the progress ring, in milliseconds. */
const TICK_MS = 100;

export interface HoldGestureOptions {
  /** Hold duration in seconds; undefined for a plain, un-gated button. */
  holdSeconds: () => number | undefined;
  /** The button cannot be pressed right now. */
  disabled: () => boolean;
  /** Runs once the hold completes. */
  onComplete: () => void;
}

export function useHoldGesture(options: HoldGestureOptions) {
  const isHolding = ref<boolean>(false);
  const elapsed = ref<number>(0);
  const hintVisible = ref<boolean>(false);

  let holdTimeout: ReturnType<typeof setTimeout> | null = null;
  let tick: ReturnType<typeof setInterval> | null = null;
  let hintTimeout: ReturnType<typeof setTimeout> | null = null;
  /** When the current press began; null when no press is in flight. */
  let pressedAt: number | null = null;

  const holdMs = () => (options.holdSeconds() ?? 0) * 1000;

  /** 0–1 across the hold, for the progress ring. */
  const progress = computed(() => (holdMs() > 0 ? Math.min(elapsed.value / holdMs(), 1) : 0));

  /** Whole seconds left, counting down to 1 on the last tick. */
  const remainingSeconds = computed(() =>
    Math.floor((holdMs() - elapsed.value + 200) / 1000) + 1);

  function clearTimers() {
    if (holdTimeout) clearTimeout(holdTimeout);
    if (tick) clearInterval(tick);
    holdTimeout = null;
    tick = null;
  }

  function reset() {
    clearTimers();
    isHolding.value = false;
    elapsed.value = 0;
    pressedAt = null;
  }

  function hideHint() {
    if (hintTimeout) clearTimeout(hintTimeout);
    hintTimeout = null;
    hintVisible.value = false;
  }

  function start() {
    if (options.disabled() || options.holdSeconds() === undefined) return;
    hideHint();
    isHolding.value = true;
    elapsed.value = 0;
    pressedAt = Date.now();

    holdTimeout = setTimeout(() => {
      // Completed: the action fires and the press is spent, so releasing the
      // mouse afterwards must not be read as a click.
      reset();
      options.onComplete();
    }, holdMs());

    tick = setInterval(() => { elapsed.value += TICK_MS; }, TICK_MS);
  }

  /** The button was released. Only a press this short asks for the hint. */
  function release() {
    const pressedFor = pressedAt === null ? null : Date.now() - pressedAt;
    reset();
    if (pressedFor !== null && pressedFor < CLICK_MS) {
      hintVisible.value = true;
      hintTimeout = setTimeout(() => { hintVisible.value = false; }, HINT_MS);
    }
  }

  /** The pointer left the button, or the button went away. Never hints. */
  function cancel() {
    reset();
  }

  onBeforeUnmount(() => {
    reset();
    hideHint();
  });

  return { isHolding, elapsed, progress, remainingSeconds, hintVisible, start, release, cancel };
}

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
 *
 * ## Input modalities
 *
 * The press is tracked through **pointer** events, not mouse events, so the
 * gesture works with a finger and a pen as well as a mouse. Synthesised mouse
 * events on touch only arrive after `touchend`, as a pair — a press held for
 * three seconds would have produced a zero-length "hold", which is to say the
 * gesture did not exist on touch at all.
 *
 * The **keyboard** is given an explicit two-step confirm rather than a timed
 * key-hold. Requiring someone to hold a key for three seconds is the same
 * barrier in another modality (WCAG 2.1.1 keyboard access, 2.5.1 pointer
 * gestures, 2.5.4 motion actuation), and it is hostile to switch access and to
 * anyone with a tremor. The first Enter/Space arms the button and says so —
 * naming the key that was pressed, so the prompt reads as an instruction rather
 * than a menu; a second press of it within [CONFIRM_MS] fires. Escape, blur, or
 * a pointer press stand it back down.
 */

/**
 * Which key armed the keyboard confirm. Kept as a token rather than the raw
 * `event.key` so the prompt can be translated — ' ' is not a word in any
 * language.
 */
export type ConfirmKey = 'enter' | 'space';

/** Maps a `KeyboardEvent.key` onto a confirm key; null for anything else. */
function confirmKeyOf(eventKey: string): ConfirmKey | null {
  if (eventKey === 'Enter') return 'enter';
  // 'Spacebar' is IE/old-Edge's name for it; harmless to accept.
  if (eventKey === ' ' || eventKey === 'Spacebar') return 'space';
  return null;
}
const CLICK_MS = 250;

/** How long the keyboard's armed confirm stays live before it lapses. */
const CONFIRM_MS = 5000;

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
  /** The keyboard's confirm step is live: the next press of [confirmKey] fires. */
  const confirmArmed = ref<boolean>(false);
  /** The key that armed the confirm, so the prompt can name it. */
  const confirmKey = ref<ConfirmKey | null>(null);

  let holdTimeout: ReturnType<typeof setTimeout> | null = null;
  let tick: ReturnType<typeof setInterval> | null = null;
  let hintTimeout: ReturnType<typeof setTimeout> | null = null;
  let confirmTimeout: ReturnType<typeof setTimeout> | null = null;
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

  function disarmConfirm() {
    if (confirmTimeout) clearTimeout(confirmTimeout);
    confirmTimeout = null;
    confirmArmed.value = false;
    confirmKey.value = null;
  }

  function start() {
    if (options.disabled() || options.holdSeconds() === undefined) return;
    // Reaching for the pointer abandons whatever the keyboard had armed.
    disarmConfirm();
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

  /**
   * Keyboard activation, in place of a timed key-hold — see the note above.
   *
   * Enter/Space is swallowed on the way in (`preventDefault`) for two reasons:
   * the browser would otherwise synthesise a `click`, which the hold-gated
   * buttons discard anyway, and Space would scroll the page under the dialog
   * the button usually sits in.
   */
  function keydown(event: KeyboardEvent) {
    if (options.disabled() || options.holdSeconds() === undefined) return;
    if (event.key === 'Escape') {
      disarmConfirm();
      return;
    }
    const key = confirmKeyOf(event.key);
    if (key === null) return;
    event.preventDefault();
    // Holding the key down auto-repeats: only the first press of each counts,
    // or one long press would arm and fire in the same breath.
    if (event.repeat) return;
    hideHint();
    if (confirmArmed.value) {
      // The prompt named a key; honour it. Arming with Enter and confirming
      // with Space would make the visible instruction a lie, and the second
      // key is as likely to be a stray press as an answer — so it re-arms
      // under its own name instead of firing.
      if (confirmKey.value === key) {
        disarmConfirm();
        options.onComplete();
        return;
      }
      disarmConfirm();
    }
    confirmArmed.value = true;
    confirmKey.value = key;
    confirmTimeout = setTimeout(() => {
      confirmArmed.value = false;
      confirmKey.value = null;
      confirmTimeout = null;
    }, CONFIRM_MS);
  }

  /** Focus left the button. An armed confirm must not survive it. */
  function blur() {
    disarmConfirm();
  }

  onBeforeUnmount(() => {
    reset();
    hideHint();
    disarmConfirm();
  });

  return {
    isHolding, elapsed, progress, remainingSeconds, hintVisible, confirmArmed, confirmKey,
    start, release, cancel, keydown, blur,
  };
}

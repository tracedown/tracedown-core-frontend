import { computed, ref } from 'vue';
import { useAuthStore } from '@/store/core/auth';
import type { ActionResult } from '@/types/actions';

/** How long after a link goes out before another may be requested. */
export const PASSWORD_LINK_RESEND_COOLDOWN_MS = 60_000;

// Module-level, so every place on the page that offers the link agrees on
// whether it went out and when another may follow: each new request voids the
// link mailed before it, so a resend is held back for a minute rather than
// offered the moment the first one leaves.
const sentTo = ref<string | null>(null);
const sending = ref<boolean>(false);
const resendReady = ref<boolean>(false);
let cooldownTimer: ReturnType<typeof setTimeout> | null = null;

function startCooldown() {
  resendReady.value = false;
  if (cooldownTimer) clearTimeout(cooldownTimer);
  cooldownTimer = setTimeout(() => {
    resendReady.value = true;
    cooldownTimer = null;
  }, PASSWORD_LINK_RESEND_COOLDOWN_MS);
}

/**
 * Emails the session user a link to set a password (the ordinary reset
 * request, to their own address) — the way an account without a password gets
 * one. `sent` holds for the rest of the page's life, for that address only, so
 * a different user signing in on the same tab starts afresh; `canResend` turns
 * true a minute after each link, when `send` may be called again.
 */
export function usePasswordSetupLink() {
  const authStore = useAuthStore();

  const email = computed(() => authStore.user?.email ?? '');
  const sent = computed(() => sentTo.value !== null && sentTo.value === email.value);
  const canResend = computed(() => sent.value && resendReady.value);

  async function send(): Promise<ActionResult> {
    const address = email.value;
    if (sending.value || (sent.value && !resendReady.value) || !address) return { ok: false };
    sending.value = true;
    try {
      const result = await authStore.requestPasswordReset(address);
      if (result.ok) {
        sentTo.value = address;
        startCooldown();
      }
      return result;
    } finally {
      sending.value = false;
    }
  }

  return { email, sending, sent, canResend, send };
}

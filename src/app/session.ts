import { useAuthStore } from '@/store/core/auth';
import { initSession } from '@/composables/useSessionInit';

/**
 * Adopts an externally-issued session token and hydrates the session, exactly as
 * a normal login would. Sessions are opaque DB-backed tokens, so any trusted
 * service sharing the database can mint one and hand it to the app — letting a
 * host-driven onboarding flow drop the user straight in without a manual sign-in.
 *
 * Resolves true when the session is live (user/orgs/workspaces hydrated).
 */
export async function establishSession(token: string): Promise<boolean> {
  // Through the store, not straight into storage: the store's own copy is what
  // `isAuthenticated` reads and what `logout` revokes.
  useAuthStore().adoptToken(token);
  return initSession();
}

import { DeviceEventEmitter } from "react-native";

/**
 * Emitted whenever a request reveals the current account is suspended
 * (or was deleted, which anonymizes the account to `status: "suspended"`).
 * AppContext listens for this once, forces a full Clerk sign-out, and shows
 * a notice on the sign-in screen — regardless of which fetch path (generated
 * hooks, useAuthedFetch, or the raw fetch calls in AppContext) noticed it.
 */
export const ACCOUNT_SUSPENDED_EVENT = "gbc.account-suspended";

// Must match the exact string returned by requireAuth in
// artifacts/api-server/src/lib/clerkAuth.ts.
const SUSPENDED_ERROR_MESSAGE = "Account suspended";

export function isSuspendedErrorBody(body: unknown): boolean {
  return (
    !!body &&
    typeof body === "object" &&
    (body as { error?: unknown }).error === SUSPENDED_ERROR_MESSAGE
  );
}

/** Call after any failed request; no-ops unless the body signals suspension. */
export function reportSuspendedIfNeeded(status: number, body: unknown): void {
  if (status === 403 && isSuspendedErrorBody(body)) {
    DeviceEventEmitter.emit(ACCOUNT_SUSPENDED_EVENT);
  }
}

/** Cancel late profile/cache writes when a session ends or changes account. */
export class SessionGeneration {
  private version = 0;
  invalidate() { this.version += 1; }
  capture() { return this.version; }
  isCurrent(version: number) { return version === this.version; }
}

export async function withDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error(message));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    controller.abort();
  }
}

/** Wait for React to observe a freshly activated SDK session, without retrying login. */
export function waitForValue<T>(read: () => T | null, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); };
    const abort = () => { cleanup(); reject(new Error("Session initialization interrupted")); };
    const check = () => {
      if (signal.aborted) { abort(); return; }
      const value = read();
      if (value !== null) { cleanup(); resolve(value); return; }
      timer = setTimeout(check, 16);
    };
    signal.addEventListener("abort", abort, { once: true });
    check();
  });
}

type SignOutActions = {
  beforeRevoke: (signal: AbortSignal) => Promise<unknown>;
  revoke: () => Promise<void>;
  isStillSignedIn: () => boolean;
  afterRevoke: () => Promise<void> | void;
  secondaryTimeoutMs?: number;
  revokeTimeoutMs?: number;
};

/** One actual SDK sign-out at a time. Failed revocation must retain local data. */
export class SignOutRunner {
  private flight: Promise<void> | null = null;
  get running() { return this.flight !== null; }
  get pending() { return this.flight; }
  run(actions: SignOutActions): Promise<void> {
    if (this.flight) return this.flight;
    this.flight = this.perform(actions).finally(() => { this.flight = null; });
    return this.flight;
  }
  private async perform(a: SignOutActions): Promise<void> {
    try {
      await withDeadline(a.beforeRevoke, a.secondaryTimeoutMs ?? 2000, "Push cleanup timed out");
    } catch { /* Optional cleanup must never prevent the SDK sign-out. */ }
    try {
      await withDeadline(() => a.revoke(), a.revokeTimeoutMs ?? 15000, "La déconnexion prend trop de temps. Vérifiez votre connexion et réessayez.");
      if (a.isStillSignedIn()) throw new Error("La session est encore ouverte. Réessayez la déconnexion.");
    } catch (error) {
      // The SDK can lose the response after the session has actually ended.
      if (a.isStillSignedIn()) throw error;
    }
    await a.afterRevoke();
  }
}

export function isSessionConflictError(error: unknown): boolean {
  const e = error as { code?: string; message?: string; errors?: { code?: string; message?: string }[] } | null;
  return (e?.errors?.[0]?.code ?? e?.code) === "session_exists" || /already signed in/i.test(e?.errors?.[0]?.message ?? e?.message ?? "");
}

export function authErrorMessage(error: unknown, fallback: string): string {
  const e = error as { code?: string; message?: string; errors?: { code?: string; message?: string }[] } | null;
  const code = e?.errors?.[0]?.code ?? e?.code;
  const message = e?.errors?.[0]?.message ?? e?.message ?? "";
  if (isSessionConflictError(error)) {
    return "Une session est déjà ouverte. Reprenez cette session ou déconnectez-vous avant de changer de compte.";
  }
  if (code === "form_password_incorrect" || code === "form_identifier_not_found") return "Email ou mot de passe incorrect.";
  if (code === "form_code_incorrect" || code === "verification_expired") return "Code invalide ou expiré. Vérifiez le code et réessayez.";
  if (code === "too_many_requests") return "Trop de tentatives. Patientez quelques instants avant de réessayer.";
  if (/network|fetch|timeout|timed out/i.test(message)) return "Le service ne répond pas. Vérifiez votre connexion et réessayez.";
  return fallback;
}

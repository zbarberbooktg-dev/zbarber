export type AuthIntent = "signup" | "signin" | null;

let pending: AuthIntent = null;

export function setAuthIntent(intent: AuthIntent) {
  pending = intent;
}

export function peekAuthIntent(): AuthIntent {
  return pending;
}

export function consumeAuthIntent(): AuthIntent {
  const v = pending;
  pending = null;
  return v;
}

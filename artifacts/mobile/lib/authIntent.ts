let pending: "signup" | null = null;

export function setAuthIntent(intent: "signup" | null) {
  pending = intent;
}

export function consumeAuthIntent(): "signup" | null {
  const v = pending;
  pending = null;
  return v;
}

// One-shot flag that lets a signed-in barber/admin open the PUBLIC home
// (app/index.tsx) without being bounced straight back to their dashboard.
// The index screen redirects barbers/admins to /(barber) by default; when this
// intent is set, that redirect is skipped for the next visit. Mirrors the
// authIntent module pattern.
let pending = false;

export function setBrowseIntent() {
  pending = true;
}

export function consumeBrowseIntent(): boolean {
  const v = pending;
  pending = false;
  return v;
}

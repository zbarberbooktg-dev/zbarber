// Reactive flag that lets a signed-in barber/admin open the PUBLIC home
// (app/index.tsx) without being bounced back to their dashboard.
//
// app/index.tsx redirects barbers/admins to /(barber) by default. When a barber
// taps "Accueil" / the home icon we set this flag and the index screen skips the
// redirect. It must be REACTIVE (not a one-shot consumed at mount): expo-router
// frequently reuses the existing index instance instead of remounting it, so a
// mount-time read would never re-run. useSyncExternalStore makes the gate
// re-evaluate on both a fresh mount AND when an existing instance is reused.
import { useSyncExternalStore } from "react";

let browsing = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setBrowsing(value: boolean) {
  if (browsing === value) return;
  browsing = value;
  emit();
}

export function useBrowsing(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => browsing,
    () => browsing,
  );
}

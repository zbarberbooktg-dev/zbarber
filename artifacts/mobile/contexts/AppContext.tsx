import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";
import { LANG_CHANGE_EVENT } from "@/hooks/useClerkLocalization";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth, useClerk } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { setAuthTokenGetter, setUnauthorizedHandler, type ApiError } from "@workspace/api-client-react";

import { localeMap, translations, type Lang } from "@/constants/i18n";
import { apiUrl } from "@/lib/api";
import { registerPushToken, unregisterPushToken } from "@/lib/push";
import { ACCOUNT_SUSPENDED_EVENT, reportSuspendedIfNeeded } from "@/lib/accountGuard";
import { SessionGeneration, SignOutRunner, withDeadline, waitForValue } from "@/lib/sessionLifecycle";
import { setAuthIntent } from "@/lib/authIntent";
import { setBrowsing } from "@/lib/browseIntent";

export type AppRole = "client" | "barber" | "admin" | null;
export type AppStatus = "active" | "suspended" | "pending" | null;
export type ThemePref = "system" | "light" | "dark";

export type SyncedUser = {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  role: Exclude<AppRole, null>;
  status: Exclude<AppStatus, null>;
  city: string | null;
  country: string | null;
  avatarUrl: string | null;
  latitude: string | null;
  longitude: string | null;
};

export type SyncedBarber = {
  id: number;
  salonName: string;
  status: "pending" | "awaiting_document" | "approved" | "rejected" | "suspended";
  city: string | null;
  documentUrl?: string | null;
  documentSubmittedAt?: string | null;
  documentDeadline?: string | null;
  documentReviewNote?: string | null;
  rejectionReason?: string | null;
};

type AppState = {
  role: AppRole;
  status: AppStatus;
  user: SyncedUser | null;
  barberProfile: SyncedBarber | null;
  syncing: boolean;
  authSyncError: boolean;
  signingOut: boolean;
  signOutError: string | null;
  signOutDestination: "/browse" | "/role-select" | "/(auth)/sign-in" | null;
  themePref: ThemePref;
  lang: Lang;
  ready: boolean;
  selectedSalonId: number | null;
  setSelectedSalonId: (id: number | null) => Promise<void>;
  setRole: (role: AppRole) => Promise<void>;
  setThemePref: (t: ThemePref) => Promise<void>;
  setLang: (l: Lang) => Promise<void>;
  signOut: (opts?: { destination?: "/browse" | "/role-select" | "/(auth)/sign-in" }) => Promise<void>;
  syncAuth: (opts?: SyncAuthOpts) => Promise<SyncedUser | null>;
  suspendedNotice: boolean;
  clearSuspendedNotice: () => void;
  t: (typeof translations)[Lang];
  locale: string;
};

const AppContext = createContext<AppState | null>(null);

const THEME_KEY = "gbc.theme";
const LANG_KEY = "gbc.lang";
const SELECTED_SALON_KEY = "gbc.selectedSalon";
const SELECTED_SALON_OWNER_KEY = "gbc.selectedSalonOwner";

type SyncResult = { user: SyncedUser; barber: SyncedBarber | null } | null;

export type SyncAuthOpts = {
  role?: "client" | "barber";
  name?: string;
  phone?: string;
  city?: string;
  country?: string;
  avatarUrl?: string;
};

async function callSync(
  token: string | null,
  opts?: SyncAuthOpts,
  { throwOnError = false, signal }: { throwOnError?: boolean; signal?: AbortSignal } = {},
): Promise<SyncResult> {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const base = domain ? `https://${domain}` : "";
  const body: Record<string, string> = {};
  if (opts?.role) body.role = opts.role;
  if (opts?.name) body.name = opts.name;
  if (opts?.phone) body.phone = opts.phone;
  if (opts?.city) body.city = opts.city;
  if (opts?.country) body.country = opts.country;
  if (opts?.avatarUrl) body.avatarUrl = opts.avatarUrl;
  const res = await fetch(`${base}/api/auth/sync`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let parsed: unknown = null;
    try { parsed = await res.json(); } catch {}
    reportSuspendedIfNeeded(res.status, parsed);
    if (throwOnError) {
      const msg = (parsed as { error?: string } | null)?.error ?? `Sync failed (${res.status})`;
      throw new Error(msg);
    }
    return null;
  }
  const data = await res.json();
  if (!data?.user) {
    if (throwOnError) throw new Error("Sync returned no user");
    return null;
  }
  return { user: data.user, barber: data.barber ?? null };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, userId, sessionId, getToken, signOut: clerkSignOut } = useAuth();
  const queryClient = useQueryClient();
  const clerk = useClerk();
  const identity = isLoaded && isSignedIn && userId ? `${userId}:${sessionId ?? ""}` : null;
  const authRef = useRef({ identity, userId, sessionId, isSignedIn, getToken, clerkSignOut });
  authRef.current = { identity, userId, sessionId, isSignedIn, getToken, clerkSignOut };
  const generation = useRef(new SessionGeneration()).current;
  const previousIdentity = useRef<string | null | undefined>(undefined);
  const initializedIdentity = useRef<string | null>(null);
  const signOutRunner = useRef(new SignOutRunner()).current;
  const signOutFlight = useRef<Promise<void> | null>(null);
  const syncSequence = useRef(0);
  const [themePref, setThemePrefState] = useState<ThemePref>("system");
  const [lang, setLangState] = useState<Lang>("fr");
  const [storageReady, setStorageReady] = useState(false);
  const [storedUser, setUser] = useState<SyncedUser | null>(null);
  const [storedBarber, setBarberProfile] = useState<SyncedBarber | null>(null);
  const [profileIdentity, setProfileIdentity] = useState<string | null>(null);
  const user = identity && profileIdentity === identity ? storedUser : null;
  const barberProfile = identity && profileIdentity === identity ? storedBarber : null;
  const [syncing, setSyncing] = useState(false);
  const [authSyncError, setAuthSyncError] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [signOutDestination, setSignOutDestination] = useState<AppState["signOutDestination"]>(null);
  const [selectedSalonId, setSelectedSalonIdState] = useState<number | null>(null);
  // The Expo push token registered for this session, kept so we can unregister
  // it on sign-out.
  const pushTokenRef = useRef<string | null>(null);
  const pushRegistrationRef = useRef<Promise<string | null> | null>(null);
  const pushAbortRef = useRef<AbortController | null>(null);

  // Push registration catches failures; this closure rejects stale sessions.
  const pushAuthedFetch = async (path: string, init: RequestInit = {}, ticket?: number) => {
    const scope = authRef.current.identity;
    const token = await authRef.current.getToken();
    if (!scope || scope !== authRef.current.identity || init.signal?.aborted || (ticket !== undefined && !generation.isCurrent(ticket))) throw new Error("Session changed");
    const headers = new Headers(init.headers);
    if (token && !headers.has("authorization")) headers.set("authorization", `Bearer ${token}`);
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    const res = await fetch(apiUrl(path), { ...init, headers });
    if (!res.ok) {
      const parsed = await res.json().catch(() => null);
      reportSuspendedIfNeeded(res.status, parsed);
      throw new Error(`HTTP ${res.status}`);
    }
    return res.status === 204 ? null : res.json().catch(() => null);
  };

  const ensurePushRegistered = (ticket: number) => {
    if (pushRegistrationRef.current || pushTokenRef.current || signOutRunner.running) return;
    const controller = new AbortController();
    pushAbortRef.current = controller;
    const registration = registerPushToken((path, init) => {
      if (!generation.isCurrent(ticket) || signOutRunner.running) return Promise.reject(new Error("Session changed"));
      return pushAuthedFetch(path, { ...init, signal: controller.signal }, ticket);
    }).then((tok) => {
      if (tok && generation.isCurrent(ticket) && !signOutRunner.running) pushTokenRef.current = tok;
      return tok;
    }).catch(() => null).finally(() => {
      if (pushRegistrationRef.current === registration) {
        pushRegistrationRef.current = null;
        pushAbortRef.current = null;
      }
    });
    pushRegistrationRef.current = registration;
  };

  useEffect(() => {
    setAuthTokenGetter(() => authRef.current.getToken());
    return () => setAuthTokenGetter(null);
    // getToken is a fresh function on each render in @clerk/expo; depending on it
    // causes an infinite re-render loop. We capture it once via a closure that
    // re-reads the latest from useAuth on each call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [t, l] = await Promise.all([
          AsyncStorage.getItem(THEME_KEY),
          AsyncStorage.getItem(LANG_KEY),
        ]);
        if (t === "light" || t === "dark" || t === "system") setThemePrefState(t);
        if (l === "fr" || l === "en") setLangState(l);
      } catch {}
      setStorageReady(true);
    })();
  }, []);

  const syncAuth = async (opts?: SyncAuthOpts) => {
    const activatedSessionId = clerk.session?.id;
    if (activatedSessionId && (!authRef.current.identity || initializedIdentity.current !== authRef.current.identity)) {
      // Signup finalize callbacks can run before useAuth has rendered the new session.
      await withDeadline((signal) => waitForValue(() => {
        const live = authRef.current;
        return live.sessionId === activatedSessionId && live.identity === initializedIdentity.current ? live.identity : null;
      }, signal), 3000, "La session s’initialise. Réessayez dans un instant.");
    }
    const scope = authRef.current.identity;
    if (!scope || signOutRunner.running) throw new Error("Aucune session à synchroniser");
    const ticket = generation.capture();
    const sequence = ++syncSequence.current;
    const current = () => generation.isCurrent(ticket) && scope === authRef.current.identity && !signOutRunner.running && sequence === syncSequence.current;
    setSyncing(true);
    setAuthSyncError(false);
    try {
      const result = await withDeadline(async (signal) => {
        const token = await authRef.current.getToken();
        if (signal.aborted || !current()) throw new Error("Session changed");
        return callSync(token, opts, { throwOnError: true, signal });
      }, 15000, "Impossible de charger votre profil. Vérifiez votre connexion.");
      if (!current()) return null;
      setUser(result?.user ?? null);
      setBarberProfile(result?.barber ?? null);
      setProfileIdentity(scope);
      if (result?.user) ensurePushRegistered(ticket);
      return result?.user ?? null;
    } catch (error) {
      if (current()) setAuthSyncError(true);
      throw error;
    } finally {
      if (current()) setSyncing(false);
    }
  };

  const clearPrivateState = (resetIntent = true) => {
    generation.invalidate();
    syncSequence.current += 1;
    void queryClient.cancelQueries().catch(() => {});
    queryClient.clear();
    setUser(null);
    setBarberProfile(null);
    setProfileIdentity(null);
    setSelectedSalonIdState(null);
    setSyncing(false);
    setAuthSyncError(false);
    pushAbortRef.current?.abort();
    pushAbortRef.current = null;
    pushRegistrationRef.current = null;
    pushTokenRef.current = null;
    if (resetIntent) setAuthIntent(null);
    setBrowsing(false);
  };

  useEffect(() => {
    if (!isLoaded) return;
    const changed = previousIdentity.current !== undefined && previousIdentity.current !== identity;
    previousIdentity.current = identity;
    clearPrivateState(changed);
    initializedIdentity.current = identity;
    if (!identity) {
      void AsyncStorage.multiRemove([SELECTED_SALON_KEY, SELECTED_SALON_OWNER_KEY]).catch(() => {});
      return;
    }
    setSignOutDestination(null);
    setSignOutError(null);
    setSuspendedNotice(false);
    const ticket = generation.capture();
    let cancelled = false;
    void (async () => {
      try {
        const [saved, owner] = await withDeadline(() => Promise.all([
          AsyncStorage.getItem(SELECTED_SALON_KEY), AsyncStorage.getItem(SELECTED_SALON_OWNER_KEY),
        ]), 1500, "Selection restore timed out").catch(() => [null, null]);
        if (cancelled || !generation.isCurrent(ticket) || authRef.current.identity !== identity) return;
        if (owner === userId && saved && Number.isFinite(Number(saved))) setSelectedSalonIdState(Number(saved));
        await syncAuth();
      } catch {
        if (!cancelled && generation.isCurrent(ticket)) setAuthSyncError(true);
      }
    })();
    return () => { cancelled = true; };
    // Auth functions are read through authRef; do not depend on unstable getters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, identity]);

  const setRole = async (_r: AppRole) => {
    // Role is now driven by Clerk + server sync; kept for API compatibility.
  };

  const setThemePref = async (t: ThemePref) => {
    setThemePrefState(t);
    await AsyncStorage.setItem(THEME_KEY, t);
  };

  const setSelectedSalonId = async (id: number | null) => {
    const owner = authRef.current.userId;
    if (!owner || !authRef.current.identity || signOutRunner.running) return;
    setSelectedSalonIdState(id);
    if (id == null) await AsyncStorage.multiRemove([SELECTED_SALON_KEY, SELECTED_SALON_OWNER_KEY]);
    else await AsyncStorage.multiSet([[SELECTED_SALON_KEY, String(id)], [SELECTED_SALON_OWNER_KEY, owner]]);
  };

  const setLang = async (l: Lang) => {
    setLangState(l);
    await AsyncStorage.setItem(LANG_KEY, l);
    DeviceEventEmitter.emit(LANG_CHANGE_EVENT, l);
  };

  const signOut: AppState["signOut"] = (opts) => {
    if (signOutFlight.current) return signOutFlight.current;
    const scope = authRef.current.identity;
    const sdk = authRef.current;
    setSigningOut(true);
    setSignOutError(null);
    setSyncing(false);
    setSignOutDestination(opts?.destination ?? "/browse");
    generation.invalidate(); // Drop late profile syncs, but retain the profile until revocation.
    const operation = signOutRunner.run({
      beforeRevoke: async (signal) => {
        const registrationAbort = pushAbortRef.current;
        signal.addEventListener("abort", () => registrationAbort?.abort(), { once: true });
        const pendingToken = await pushRegistrationRef.current;
        const tok = pushTokenRef.current ?? pendingToken;
        if (!tok || signal.aborted || authRef.current.identity !== scope) return;
        const token = await sdk.getToken();
        if (!token || signal.aborted || authRef.current.identity !== scope) return;
        await unregisterPushToken(async (path, init) => {
          const headers = new Headers(init?.headers);
          headers.set("authorization", `Bearer ${token}`);
          headers.set("content-type", "application/json");
          const response = await fetch(apiUrl(path), { ...init, headers, signal });
          if (!response.ok) throw new Error("Push cleanup failed");
        }, tok);
      },
      revoke: () => sdk.clerkSignOut(sdk.sessionId ? { sessionId: sdk.sessionId } : undefined),
      isStillSignedIn: () => sdk.sessionId ? clerk.session?.id === sdk.sessionId : !!clerk.session,
      afterRevoke: async () => {
        if (authRef.current.identity && authRef.current.identity !== scope) return;
        clearPrivateState();
        await withDeadline(() => AsyncStorage.multiRemove([SELECTED_SALON_KEY, SELECTED_SALON_OWNER_KEY]), 1500, "Cleanup timed out").catch(() => {});
      },
    });
    const result = operation.catch(() => {
      setSignOutDestination(null);
      setSignOutError("Déconnexion impossible. Votre session n’a pas pu être fermée. Vérifiez votre connexion puis réessayez.");
      if (authRef.current.identity === scope) {
        // Push was unregistered before revocation; restore it if the session survives.
        pushAbortRef.current?.abort();
        pushRegistrationRef.current = null;
        pushTokenRef.current = null;
        ensurePushRegistered(generation.capture());
      }
      throw new Error("Déconnexion impossible. Veuillez réessayer.");
    }).finally(() => {
      signOutFlight.current = null;
      setSigningOut(false);
    });
    signOutFlight.current = result;
    return result;
  };

  const [suspendedNotice, setSuspendedNotice] = useState(false);
  const clearSuspendedNotice = () => setSuspendedNotice(false);

  // Always call the *latest* signOut from the event listener below without
  // re-subscribing on every render (signOut's identity changes each render).
  const signOutRef = useRef(signOut);
  signOutRef.current = signOut;

  // Any request — generated hooks, useAuthedFetch, or the raw fetch calls in
  // this file — that hits a 403 "Account suspended" response reports it here.
  // We react once, from a single place: force a full Clerk sign-out (not just
  // clearing local state) so a suspended/deleted account can neither keep
  // using an already-open session nor silently sit half-signed-in, and show a
  // notice on the sign-in screen so the user understands why.
  useEffect(() => {
    setUnauthorizedHandler((err: ApiError) => reportSuspendedIfNeeded(err.status, err.data));
    const sub = DeviceEventEmitter.addListener(ACCOUNT_SUSPENDED_EVENT, () => {
      setSuspendedNotice(true);
      signOutRef.current({ destination: "/(auth)/sign-in" }).catch(() => {});
    });
    return () => {
      setUnauthorizedHandler(null);
      sub.remove();
    };
  }, []);

  const value = useMemo<AppState>(
    () => ({
      role: user?.role ?? null,
      status: user?.status ?? null,
      user,
      barberProfile,
      syncing,
      authSyncError,
      signingOut,
      signOutError,
      signOutDestination,
      themePref,
      lang,
      ready: storageReady,
      selectedSalonId: user ? selectedSalonId : null,
      setSelectedSalonId,
      setRole,
      setThemePref,
      setLang,
      signOut,
      syncAuth,
      suspendedNotice,
      clearSuspendedNotice,
      t: translations[lang],
      locale: localeMap[lang],
    }),
    [user, barberProfile, syncing, authSyncError, signingOut, signOutError, signOutDestination, themePref, lang, storageReady, isLoaded, selectedSalonId, suspendedNotice],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function useT() {
  return useApp().t;
}

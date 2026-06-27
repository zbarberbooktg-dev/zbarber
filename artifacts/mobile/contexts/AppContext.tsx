import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";
import { LANG_CHANGE_EVENT } from "@/hooks/useClerkLocalization";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/expo";
import { setAuthTokenGetter } from "@workspace/api-client-react";

import { localeMap, translations, type Lang } from "@/constants/i18n";
import { apiUrl } from "@/lib/api";
import { registerPushToken, unregisterPushToken } from "@/lib/push";

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
};

type AppState = {
  role: AppRole;
  status: AppStatus;
  user: SyncedUser | null;
  barberProfile: SyncedBarber | null;
  syncing: boolean;
  themePref: ThemePref;
  lang: Lang;
  ready: boolean;
  selectedSalonId: number | null;
  setSelectedSalonId: (id: number | null) => Promise<void>;
  setRole: (role: AppRole) => Promise<void>;
  setThemePref: (t: ThemePref) => Promise<void>;
  setLang: (l: Lang) => Promise<void>;
  signOut: () => Promise<void>;
  syncAuth: (opts?: SyncAuthOpts) => Promise<SyncedUser | null>;
  t: (typeof translations)[Lang];
  locale: string;
};

const AppContext = createContext<AppState | null>(null);

const THEME_KEY = "gbc.theme";
const LANG_KEY = "gbc.lang";
const SELECTED_SALON_KEY = "gbc.selectedSalon";

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
  { throwOnError = false }: { throwOnError?: boolean } = {},
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
  });
  if (!res.ok) {
    if (throwOnError) {
      let msg = `Sync failed (${res.status})`;
      try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
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
  const { isLoaded, isSignedIn, getToken, signOut: clerkSignOut } = useAuth();
  const [themePref, setThemePrefState] = useState<ThemePref>("system");
  const [lang, setLangState] = useState<Lang>("fr");
  const [storageReady, setStorageReady] = useState(false);
  const [user, setUser] = useState<SyncedUser | null>(null);
  const [barberProfile, setBarberProfile] = useState<SyncedBarber | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [initialSyncDone, setInitialSyncDone] = useState(false);
  const [selectedSalonId, setSelectedSalonIdState] = useState<number | null>(null);
  // The Expo push token registered for this session, kept so we can unregister
  // it on sign-out.
  const pushTokenRef = useRef<string | null>(null);

  // Authed fetch closure for push (de)registration. Re-reads the latest token
  // on each call via getToken; never throws to the caller.
  const pushAuthedFetch = async (path: string, init: RequestInit = {}) => {
    const token = await getToken();
    const headers = new Headers(init.headers);
    if (token && !headers.has("authorization")) headers.set("authorization", `Bearer ${token}`);
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    const res = await fetch(apiUrl(path), { ...init, headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.status === 204 ? null : res.json().catch(() => null);
  };

  const ensurePushRegistered = () => {
    registerPushToken(pushAuthedFetch)
      .then((tok) => { if (tok) pushTokenRef.current = tok; })
      .catch(() => {});
  };

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
    // getToken is a fresh function on each render in @clerk/expo; depending on it
    // causes an infinite re-render loop. We capture it once via a closure that
    // re-reads the latest from useAuth on each call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [t, l, s] = await Promise.all([
          AsyncStorage.getItem(THEME_KEY),
          AsyncStorage.getItem(LANG_KEY),
          AsyncStorage.getItem(SELECTED_SALON_KEY),
        ]);
        if (t === "light" || t === "dark" || t === "system") setThemePrefState(t);
        if (l === "fr" || l === "en") setLangState(l);
        if (s != null && s !== "") {
          const n = parseInt(s);
          if (Number.isFinite(n)) setSelectedSalonIdState(n);
        }
      } catch {}
      setStorageReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setUser(null); setBarberProfile(null); setInitialSyncDone(true); return; }
    let cancel = false;
    (async () => {
      setSyncing(true);
      try {
        const token = await getToken();
        const result = await callSync(token);
        if (!cancel) {
          setUser(result?.user ?? null);
          setBarberProfile(result?.barber ?? null);
          if (result?.user) ensurePushRegistered();
        }
      } finally {
        if (!cancel) { setSyncing(false); setInitialSyncDone(true); }
      }
    })();
    return () => { cancel = true; };
    // Intentionally exclude getToken (unstable identity in @clerk/expo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  const syncAuth = async (opts?: SyncAuthOpts) => {
    setSyncing(true);
    try {
      const token = await getToken();
      const result = await callSync(token, opts, { throwOnError: true });
      setUser(result?.user ?? null);
      setBarberProfile(result?.barber ?? null);
      return result?.user ?? null;
    } finally {
      setSyncing(false);
    }
  };

  const setRole = async (_r: AppRole) => {
    // Role is now driven by Clerk + server sync; kept for API compatibility.
  };

  const setThemePref = async (t: ThemePref) => {
    setThemePrefState(t);
    await AsyncStorage.setItem(THEME_KEY, t);
  };

  const setSelectedSalonId = async (id: number | null) => {
    setSelectedSalonIdState(id);
    if (id == null) await AsyncStorage.removeItem(SELECTED_SALON_KEY);
    else await AsyncStorage.setItem(SELECTED_SALON_KEY, String(id));
  };

  const setLang = async (l: Lang) => {
    setLangState(l);
    await AsyncStorage.setItem(LANG_KEY, l);
    DeviceEventEmitter.emit(LANG_CHANGE_EVENT, l);
  };

  const signOut = async () => {
    // Best-effort: drop this device's push token before the session ends so the
    // signed-out account stops receiving pushes on this device.
    const tok = pushTokenRef.current;
    if (tok) { await unregisterPushToken(pushAuthedFetch, tok); pushTokenRef.current = null; }
    setUser(null);
    setBarberProfile(null);
    await clerkSignOut();
  };

  const value = useMemo<AppState>(
    () => ({
      role: user?.role ?? null,
      status: user?.status ?? null,
      user,
      barberProfile,
      syncing,
      themePref,
      lang,
      ready: storageReady && isLoaded && initialSyncDone,
      selectedSalonId,
      setSelectedSalonId,
      setRole,
      setThemePref,
      setLang,
      signOut,
      syncAuth,
      t: translations[lang],
      locale: localeMap[lang],
    }),
    [user, barberProfile, syncing, themePref, lang, storageReady, isLoaded, initialSyncDone, selectedSalonId],
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

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/expo";
import { setAuthTokenGetter } from "@workspace/api-client-react";

import { localeMap, translations, type Lang } from "@/constants/i18n";

export type AppRole = "client" | "barber" | "admin" | null;
export type AppStatus = "active" | "suspended" | "pending" | null;
export type ThemePref = "system" | "light" | "dark";

export type SyncedUser = {
  id: number;
  email: string;
  name: string;
  role: Exclude<AppRole, null>;
  status: Exclude<AppStatus, null>;
};

type AppState = {
  role: AppRole;
  status: AppStatus;
  user: SyncedUser | null;
  syncing: boolean;
  themePref: ThemePref;
  lang: Lang;
  ready: boolean;
  setRole: (role: AppRole) => Promise<void>;
  setThemePref: (t: ThemePref) => Promise<void>;
  setLang: (l: Lang) => Promise<void>;
  signOut: () => Promise<void>;
  syncAuth: (initialRole?: "client" | "barber") => Promise<SyncedUser | null>;
  t: (typeof translations)[Lang];
  locale: string;
};

const AppContext = createContext<AppState | null>(null);

const THEME_KEY = "gbc.theme";
const LANG_KEY = "gbc.lang";

async function callSync(token: string | null, initialRole?: "client" | "barber"): Promise<SyncedUser | null> {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const base = domain ? `https://${domain}` : "";
  const res = await fetch(`${base}/api/auth/sync`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(initialRole ? { role: initialRole } : {}),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.user ?? null;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, getToken, signOut: clerkSignOut } = useAuth();
  const [themePref, setThemePrefState] = useState<ThemePref>("system");
  const [lang, setLangState] = useState<Lang>("fr");
  const [storageReady, setStorageReady] = useState(false);
  const [user, setUser] = useState<SyncedUser | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [initialSyncDone, setInitialSyncDone] = useState(false);

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

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setUser(null); setInitialSyncDone(true); return; }
    let cancel = false;
    (async () => {
      setSyncing(true);
      try {
        const token = await getToken();
        const u = await callSync(token);
        if (!cancel) setUser(u);
      } finally {
        if (!cancel) { setSyncing(false); setInitialSyncDone(true); }
      }
    })();
    return () => { cancel = true; };
    // Intentionally exclude getToken (unstable identity in @clerk/expo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  const syncAuth = async (initialRole?: "client" | "barber") => {
    setSyncing(true);
    try {
      const token = await getToken();
      const u = await callSync(token, initialRole);
      setUser(u);
      return u;
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

  const setLang = async (l: Lang) => {
    setLangState(l);
    await AsyncStorage.setItem(LANG_KEY, l);
  };

  const signOut = async () => {
    setUser(null);
    await clerkSignOut();
  };

  const value = useMemo<AppState>(
    () => ({
      role: user?.role ?? null,
      status: user?.status ?? null,
      user,
      syncing,
      themePref,
      lang,
      ready: storageReady && isLoaded && initialSyncDone,
      setRole,
      setThemePref,
      setLang,
      signOut,
      syncAuth,
      t: translations[lang],
      locale: localeMap[lang],
    }),
    [user, syncing, themePref, lang, storageReady, isLoaded, initialSyncDone],
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

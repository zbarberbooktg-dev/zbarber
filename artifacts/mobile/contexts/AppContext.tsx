import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { localeMap, translations, type Lang } from "@/constants/i18n";

export type AppRole = "client" | "barber" | null;
export type ThemePref = "system" | "light" | "dark";

type AppState = {
  role: AppRole;
  themePref: ThemePref;
  lang: Lang;
  ready: boolean;
  setRole: (role: AppRole) => Promise<void>;
  setThemePref: (t: ThemePref) => Promise<void>;
  setLang: (l: Lang) => Promise<void>;
  signOut: () => Promise<void>;
  t: (typeof translations)[Lang];
  locale: string;
};

const AppContext = createContext<AppState | null>(null);

const ROLE_KEY = "gbc.role";
const THEME_KEY = "gbc.theme";
const LANG_KEY = "gbc.lang";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<AppRole>(null);
  const [themePref, setThemePrefState] = useState<ThemePref>("system");
  const [lang, setLangState] = useState<Lang>("fr");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [r, t, l] = await Promise.all([
          AsyncStorage.getItem(ROLE_KEY),
          AsyncStorage.getItem(THEME_KEY),
          AsyncStorage.getItem(LANG_KEY),
        ]);
        if (r === "client" || r === "barber") setRoleState(r);
        if (t === "light" || t === "dark" || t === "system") setThemePrefState(t);
        if (l === "fr" || l === "en") setLangState(l);
      } catch {}
      setReady(true);
    })();
  }, []);

  const setRole = async (r: AppRole) => {
    setRoleState(r);
    if (r) await AsyncStorage.setItem(ROLE_KEY, r);
    else await AsyncStorage.removeItem(ROLE_KEY);
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
    await setRole(null);
  };

  const value = useMemo<AppState>(
    () => ({
      role,
      themePref,
      lang,
      ready,
      setRole,
      setThemePref,
      setLang,
      signOut,
      t: translations[lang],
      locale: localeMap[lang],
    }),
    [role, themePref, lang, ready],
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

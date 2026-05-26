import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export type AppRole = "client" | "barber" | null;
export type ThemePref = "system" | "light" | "dark";

type AppState = {
  role: AppRole;
  themePref: ThemePref;
  ready: boolean;
  setRole: (role: AppRole) => Promise<void>;
  setThemePref: (t: ThemePref) => Promise<void>;
  signOut: () => Promise<void>;
};

const AppContext = createContext<AppState | null>(null);

const ROLE_KEY = "gbc.role";
const THEME_KEY = "gbc.theme";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<AppRole>(null);
  const [themePref, setThemePrefState] = useState<ThemePref>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [r, t] = await Promise.all([
          AsyncStorage.getItem(ROLE_KEY),
          AsyncStorage.getItem(THEME_KEY),
        ]);
        if (r === "client" || r === "barber") setRoleState(r);
        if (t === "light" || t === "dark" || t === "system") setThemePrefState(t);
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

  const signOut = async () => {
    await setRole(null);
  };

  return (
    <AppContext.Provider value={{ role, themePref, ready, setRole, setThemePref, signOut }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

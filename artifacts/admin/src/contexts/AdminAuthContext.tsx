import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  adminLogin as apiLogin,
  adminLogout as apiLogout,
  adminMe,
  adminChangePassword as apiChangePassword,
  AdminApiError,
  type AdminAccount,
} from "@/lib/adminApi";

interface AdminAuthState {
  admin: AdminAccount | null;
  loading: boolean;
  error: unknown;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AdminAuthState | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { admin } = await adminMe();
      setAdmin(admin);
    } catch (err) {
      if (err instanceof AdminApiError && (err.status === 401 || err.status === 403)) {
        setAdmin(null);
      } else {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const { admin } = await apiLogin(email, password);
    setAdmin(admin);
  }, []);

  const logout = useCallback(async () => {
    try { await apiLogout(); } catch { /* clear local even on network error */ }
    setAdmin(null);
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await apiChangePassword(currentPassword, newPassword);
    setAdmin((a) => (a ? { ...a, mustChangePassword: false } : a));
  }, []);

  return (
    <Ctx.Provider value={{ admin, loading, error, login, logout, changePassword, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAdminAuth(): AdminAuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return v;
}

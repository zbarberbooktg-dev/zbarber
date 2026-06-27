import { useAuth } from "@clerk/expo";
import { useCallback } from "react";

export function apiUrl(path: string): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const base = domain ? `https://${domain}` : "";
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

// Append the selected salon id to an API path so multi-salon barbers scope
// every self-service request to the salon they picked in the dashboard.
export function withSalon(path: string, salonId: number | null | undefined): string {
  if (salonId == null) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}salonId=${salonId}`;
}

export function useAuthedFetch() {
  const { getToken } = useAuth();
  return useCallback(
    async <T = unknown>(path: string, init: RequestInit = {}): Promise<T> => {
      const token = await getToken();
      const headers = new Headers(init.headers);
      if (token && !headers.has("authorization")) headers.set("authorization", `Bearer ${token}`);
      if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
      const res = await fetch(apiUrl(path), { ...init, headers });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        throw new Error(errBody || `HTTP ${res.status}`);
      }
      if (res.status === 204) return null as T;
      return (await res.json()) as T;
    },
    [getToken],
  );
}

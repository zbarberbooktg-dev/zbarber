import { useAuth } from "@clerk/expo";
import { useCallback, useEffect, useRef } from "react";

export function apiUrl(path: string): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const base = domain ? `https://${domain}` : "";
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function useAuthedFetch() {
  const { getToken } = useAuth();
  // `getToken` from @clerk/expo has an unstable identity (new function every
  // render). Capture it in a ref so the returned fetcher stays referentially
  // stable — otherwise consumers that put the fetcher in useEffect/useCallback
  // deps re-run every render and hit "Maximum update depth exceeded".
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);
  return useCallback(
    async <T = unknown>(path: string, init: RequestInit = {}): Promise<T> => {
      const token = await getTokenRef.current();
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
    [],
  );
}

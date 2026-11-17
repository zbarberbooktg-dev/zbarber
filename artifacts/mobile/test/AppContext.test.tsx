import React from "react";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const h = vi.hoisted(() => ({
  auth: {} as { isLoaded: boolean; isSignedIn: boolean; userId: string | null; sessionId: string | null; getToken: ReturnType<typeof vi.fn>; signOut: ReturnType<typeof vi.fn> },
  sdk: { session: null as { id: string } | null },
  storage: new Map<string, string>(),
  listeners: new Map<string, () => void>(),
}));
vi.mock("@clerk/expo", () => ({ useAuth: () => h.auth, useClerk: () => h.sdk }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {
  getItem: vi.fn(async (key: string) => h.storage.get(key) ?? null),
  setItem: vi.fn(async (key: string, value: string) => { h.storage.set(key, value); }),
  multiSet: vi.fn(async (pairs: string[][]) => { pairs.forEach(([k, v]) => h.storage.set(k, v)); }),
  multiRemove: vi.fn(async (keys: string[]) => { keys.forEach((k) => h.storage.delete(k)); }),
} }));
vi.mock("react-native", () => ({ DeviceEventEmitter: {
  addListener: (name: string, listener: () => void) => {
    h.listeners.set(name, listener);
    return { remove: () => h.listeners.delete(name) };
  },
  emit: vi.fn(),
} }));
vi.mock("@workspace/api-client-react", () => ({ setAuthTokenGetter: vi.fn(), setUnauthorizedHandler: vi.fn() }));
vi.mock("@/hooks/useClerkLocalization", () => ({ LANG_CHANGE_EVENT: "lang" }));
vi.mock("@/lib/push", () => ({ registerPushToken: vi.fn(async () => null), unregisterPushToken: vi.fn(async () => {}) }));
vi.mock("@/lib/api", () => ({ apiUrl: (path: string) => path }));
vi.mock("@/lib/accountGuard", () => ({ ACCOUNT_SUSPENDED_EVENT: "suspended", reportSuspendedIfNeeded: vi.fn() }));

import { AppProvider, useApp } from "../contexts/AppContext";
import { registerPushToken, unregisterPushToken } from "../lib/push";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let value: ReturnType<typeof useApp>;
let root: ReactTestRenderer | undefined;
let query: QueryClient;
let fetchMock: ReturnType<typeof vi.fn>;
function Observer() { value = useApp(); return null; }
function Harness() {
  return <QueryClientProvider client={query}><AppProvider><Observer /></AppProvider></QueryClientProvider>;
}
function response(account: "A" | "B") {
  return new Response(JSON.stringify({ user: {
    id: account === "A" ? 1 : 2, name: `Client ${account}`, role: "client", status: "active",
  }, barber: null }), { status: 200, headers: { "content-type": "application/json" } });
}
function setAccount(account: "A" | "B" | null) {
  h.sdk.session = account ? { id: `session${account}` } : null;
  h.auth = {
    ...h.auth, isLoaded: true, isSignedIn: !!account,
    userId: account ? `clerk${account}` : null, sessionId: account ? `session${account}` : null,
    getToken: vi.fn(async () => account ? `fake-token-${account}` : null),
  };
}
async function mount() { await act(async () => { root = TestRenderer.create(<Harness />); }); }
async function switchAccount(account: "A" | "B" | null) {
  await act(async () => { setAccount(account); root!.update(<Harness />); });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(registerPushToken).mockResolvedValue(null);
  h.storage.clear();
  h.listeners.clear();
  h.auth = { isLoaded: true, isSignedIn: false, userId: null, sessionId: null, getToken: vi.fn(), signOut: vi.fn() };
  setAccount("A");
  query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  fetchMock = vi.fn(async (_url: string, init: RequestInit) => response(new Headers(init.headers).get("authorization")?.endsWith("-B") ? "B" : "A"));
  vi.stubGlobal("fetch", fetchMock);
  h.auth.signOut.mockImplementation(async () => {
    setAccount(null);
    root?.update(<Harness />);
  });
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = undefined;
  query.clear();
  vi.unstubAllGlobals();
});

test("loads only the signed-in account's profile and salon selection", async () => {
  h.storage.set("gbc.selectedSalon", "42");
  h.storage.set("gbc.selectedSalonOwner", "clerkA");
  await mount();
  expect(value.user?.name).toBe("Client A");
  expect(value.selectedSalonId).toBe(42);
  expect(value.authSyncError).toBe(false);
});

test("waits for Clerk, prevents duplicate logout, then clears the actual query cache", async () => {
  await mount();
  await act(async () => { await value.setSelectedSalonId(42); });
  query.setQueryData(["reservations"], ["A private reservation"]);
  const sdk = deferred<void>();
  h.auth.signOut.mockImplementation(async () => { await sdk.promise; setAccount(null); root!.update(<Harness />); });
  let first!: Promise<void>, second!: Promise<void>;
  await act(async () => { first = value.signOut(); second = value.signOut(); });
  expect(first).toBe(second);
  expect(h.auth.signOut).toHaveBeenCalledTimes(1);
  expect(h.auth.signOut).toHaveBeenCalledWith({ sessionId: "sessionA" });
  expect(value.signingOut).toBe(true);
  expect(value.user?.name).toBe("Client A");
  expect(query.getQueryData(["reservations"])).toEqual(["A private reservation"]);
  await act(async () => { sdk.resolve(); await first; });
  expect(value.user).toBeNull();
  expect(value.barberProfile).toBeNull();
  expect(value.selectedSalonId).toBeNull();
  expect(value.signingOut).toBe(false);
  expect(query.getQueryCache().getAll()).toHaveLength(0);
  expect(h.storage.has("gbc.selectedSalon")).toBe(false);
  expect(value.signOutDestination).toBe("/browse");
});

test("failed Clerk revocation leaves the account and private cache intact with a French retry error", async () => {
  await mount();
  query.setQueryData(["reservations"], ["A private reservation"]);
  h.auth.signOut.mockRejectedValue(new Error("Network failure"));
  await act(async () => { await expect(value.signOut()).rejects.toThrow("Déconnexion"); });
  expect(value.user?.name).toBe("Client A");
  expect(query.getQueryData(["reservations"])).toEqual(["A private reservation"]);
  expect(value.signingOut).toBe(false);
  expect(value.signOutDestination).toBeNull();
  expect(value.signOutError).toContain("Vérifiez votre connexion");
});

test("changing accounts while isSignedIn stays true clears A's cached queries and selection", async () => {
  await mount();
  await act(async () => { await value.setSelectedSalonId(42); });
  query.setQueryData(["reservations"], ["A private reservation"]);
  await switchAccount("B");
  expect(value.user?.name).toBe("Client B");
  expect(value.selectedSalonId).toBeNull();
  expect(query.getQueryCache().getAll()).toHaveLength(0);
});

test("a late profile response cannot repopulate private state after logout", async () => {
  await mount();
  const oldResponse = deferred<Response>();
  fetchMock.mockImplementationOnce(() => oldResponse.promise);
  let pending!: ReturnType<typeof value.syncAuth>;
  await act(async () => { pending = value.syncAuth(); });
  await act(async () => { await value.signOut(); });
  await act(async () => { oldResponse.resolve(response("A")); await pending; });
  expect(value.user).toBeNull();
  expect(value.barberProfile).toBeNull();
  expect(value.selectedSalonId).toBeNull();
});

test("a late A profile cannot overwrite B after an account switch", async () => {
  await mount();
  const oldResponse = deferred<Response>();
  fetchMock.mockImplementationOnce(() => oldResponse.promise);
  let pending!: ReturnType<typeof value.syncAuth>;
  await act(async () => { pending = value.syncAuth(); });
  await switchAccount("B");
  expect(value.user?.name).toBe("Client B");
  await act(async () => { oldResponse.resolve(response("A")); await pending; });
  expect(value.user?.name).toBe("Client B");
});

test("an active session with an unavailable profile can retry without another sign-in", async () => {
  fetchMock.mockResolvedValueOnce(new Response('{"error":"Temporary failure"}', { status: 503 }));
  await mount();
  expect(value.user).toBeNull();
  expect(value.authSyncError).toBe(true);
  expect(h.auth.isSignedIn).toBe(true);
  await act(async () => { await value.syncAuth(); });
  expect(value.user?.name).toBe("Client A");
  expect(value.authSyncError).toBe(false);
});

test("signup finalize may request profile sync before useAuth observes the new session", async () => {
  setAccount(null);
  await mount();
  h.sdk.session = { id: "sessionB" }; // SDK activates before the React hook updates.
  let pending!: ReturnType<typeof value.syncAuth>;
  await act(async () => { pending = value.syncAuth({ name: "New client" }); });
  await switchAccount("B");
  await act(async () => { await pending; });
  expect(fetchMock.mock.calls.some(([, init]) => JSON.parse(init.body as string).name === "New client")).toBe(true);
  expect(value.user?.name).toBe("Client B");
});

test("a suspended account's notice cannot block the next account", async () => {
  await mount();
  h.auth.signOut.mockRejectedValue(new Error("Offline"));
  await act(async () => { h.listeners.get("suspended")!(); });
  expect(value.suspendedNotice).toBe(true);
  await switchAccount("B");
  expect(value.user?.name).toBe("Client B");
  expect(value.suspendedNotice).toBe(false);
});

test("push registration is restored if logout fails after unregistering the device", async () => {
  vi.mocked(registerPushToken).mockResolvedValueOnce("fake-device-token");
  await mount();
  expect(registerPushToken).toHaveBeenCalledTimes(1);
  h.auth.signOut.mockRejectedValue(new Error("Offline"));
  await act(async () => { await expect(value.signOut()).rejects.toThrow("Déconnexion"); });
  expect(unregisterPushToken).toHaveBeenCalledWith(expect.any(Function), "fake-device-token");
  expect(registerPushToken).toHaveBeenCalledTimes(2);
  expect(value.user?.name).toBe("Client A");
});

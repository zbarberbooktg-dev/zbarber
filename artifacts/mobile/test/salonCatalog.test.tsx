import React from "react";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useApprovedSalonCatalog, setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { newestRegisteredSalons } from "../lib/salonSearch";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReactTestRenderer;
let query: QueryClient;
let state: ReturnType<typeof useApprovedSalonCatalog>;
let fetchMock: ReturnType<typeof vi.fn>;
const all = Array.from({ length: 205 }, (_, i) => ({
  id: i + 1, salonName: `Test ${i}`, status: "approved", createdAt: new Date(2026, 0, i + 1).toISOString(),
  latitude: 0, longitude: i / 100,
}));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function Probe() { state = useApprovedSalonCatalog(); return null; }
async function mount() {
  await act(async () => { root = TestRenderer.create(<QueryClientProvider client={query}><Probe /></QueryClientProvider>); });
  for (let i = 0; i < 30 && state.isLoading; i++) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
}
beforeEach(() => {
  query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  setBaseUrl("https://catalog.example");
  setAuthTokenGetter(() => Promise.resolve(null));
  fetchMock = vi.fn(async (url: string) => {
    const params = new URL(url).searchParams;
    const page = Number(params.get("page")), limit = Number(params.get("limit"));
    if (!url.includes("/api/barbers?")) return json({ error: "Internal Server Error" }, 500);
    return json({ data: all.slice((page - 1) * limit, page * limit), total: all.length, page, limit });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(async () => { await act(async () => root.unmount()); query.clear(); vi.unstubAllGlobals(); });
test("loads all pages from the working public catalog, without calling the broken map endpoint", async () => {
  await mount();
  expect(state.isLoading).toBe(false);
  expect(state.isError).toBe(false);
  expect(state.data).toHaveLength(205);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(fetchMock.mock.calls.every(([url]) => String(url).includes("status=approved") && !String(url).includes("map-points"))).toBe(true);
  expect(newestRegisteredSalons(state.data).map((b) => b.id)).toEqual(Array.from({ length: 20 }, (_, i) => 205 - i));
});
test("a failed catalog page is an error, never a successful empty search", async () => {
  fetchMock.mockImplementation(async (url: string) => new URL(url).searchParams.get("page") === "2"
    ? json({ error: "Unavailable" }, 500)
    : json({ data: all.slice(0, 100), total: 205, page: 1, limit: 100 }));
  await mount();
  expect(state.isLoading).toBe(false);
  expect(state.isError).toBe(true);
});
test("a server ignoring pagination is detected instead of silently losing salons", async () => {
  fetchMock.mockImplementation(async () => json({ data: all.slice(0, 100), total: 205, page: 1, limit: 100 }));
  await mount();
  expect(state.isLoading).toBe(false);
  expect(state.isError).toBe(true);
});
test("malformed responses are errors, not zero salons", async () => {
  fetchMock.mockImplementation(async () => new Response("Not a catalog"));
  await mount();
  expect(state.isError).toBe(true);
});

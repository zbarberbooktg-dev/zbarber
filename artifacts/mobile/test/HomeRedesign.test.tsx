import React from "react";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const h = vi.hoisted(() => ({
  signedIn: false, loaded: true, role: "client", ready: true, path: "/browse",
  list: vi.fn(), catalog: vi.fn(), user: null as object | null,
}));
vi.mock("react-native", () => ({
  ActivityIndicator: "Spinner", RefreshControl: "RefreshControl", ScrollView: "ScrollView", View: "View",
  useWindowDimensions: () => ({ width: 414, height: 896 }),
}));
vi.mock("@clerk/expo", () => ({ useAuth: () => ({ isSignedIn: h.signedIn, isLoaded: h.loaded }) }));
vi.mock("@workspace/zbarber-design/hooks/use-colors", () => ({ useColors: () => ({ background: "#0C0D10", primary: "#C9A76A" }) }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: { getItem: async () => "1" } }));
vi.mock("../app/onboarding", () => ({ ONBOARDING_KEY: "gbc.onboarding.v1" }));
vi.mock("expo-router", () => ({
  usePathname: () => h.path, useLocalSearchParams: () => ({}), Redirect: "Redirect",
  useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]),
}));
vi.mock("@/contexts/AppContext", () => ({
  useApp: () => ({ ready: h.ready, syncing: false, user: h.user, role: h.role, lang: "fr" }),
}));
vi.mock("@/lib/browseIntent", () => ({ useBrowsing: () => false }));
vi.mock("@/hooks/home/useHomeFavorites", () => ({ useHomeFavorites: () => ({}) }));
vi.mock("@/hooks/home/useNearbyLocation", () => ({ useNearbyLocation: () => ({ position: null }) }));
vi.mock("@workspace/api-client-react", () => ({
  getListBarbersQueryKey: (params: object) => ["/api/barbers", params],
  useListBarbers: (params: object) => h.list(params),
  useApprovedSalonCatalog: () => h.catalog(),
}));
vi.mock("@/components/SalonAdsCarousel", () => ({ SalonAdsCarousel: "SalonAdsCarousel" }));
vi.mock("@/components/home/HomeHeader", () => ({ HomeTopBar: "HomeTopBar", HomeSearch: "HomeSearch" }));
vi.mock("@/components/home/CategoryRow", () => ({ CategoryRow: "CategoryRow" }));
vi.mock("@/components/home/NearbySection", () => ({ NearbySection: "NearbySection" }));
vi.mock("@/components/home/DiscoverSection", () => ({ DiscoverSection: "DiscoverSection" }));
vi.mock("@/components/home/SearchResults", () => ({ SearchResults: "SearchResults" }));
vi.mock("@/components/home/InspirationSection", () => ({ InspirationSection: "InspirationSection" }));
vi.mock("@/components/home/JournalSection", () => ({ JournalSection: "JournalSection" }));
vi.mock("@/components/home/CatalogFooter", () => ({ CatalogFooter: "CatalogFooter" }));
vi.mock("@/components/home/HomeBottomNav", () => ({ HomeBottomNav: "HomeBottomNav" }));
vi.mock("@/components/home/HomeSkeletons", () => ({ CardRowSkeleton: "Skeleton", ListSkeleton: "ListSkeleton" }));
vi.mock("@/components/home/LazyMount", () => ({ LazyMount: ({ children }: React.PropsWithChildren) => children }));

import PublicHome from "../app/index";
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReactTestRenderer;
const refetch = vi.fn();
const salons = [
  { id: 1, salonName: "Fixture ancien", createdAt: "2026-01-01" },
  { id: 2, salonName: "Fixture récent", createdAt: "2026-11-01" },
];
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  Object.assign(h, { signedIn: false, loaded: true, role: "client", ready: true, path: "/browse", user: null });
  h.list.mockReturnValue({ data: { data: salons, total: 85 }, refetch });
  h.catalog.mockReturnValue({ data: salons, refetch });
});
afterEach(async () => { if (root) await act(async () => root.unmount()); vi.useRealTimers(); });
const node = (name: string) => root.root.findByType(name as never);
async function mount() { await act(async () => { root = TestRenderer.create(<PublicHome />); }); }

test("keeps the requested section order and registered-newest sorting", async () => {
  await mount();
  const names = root.root.findAll(n => typeof n.type === "string").map(n => String(n.type));
  const order = ["HomeTopBar", "HomeSearch", "CategoryRow", "SalonAdsCarousel", "NearbySection", "DiscoverSection", "InspirationSection", "JournalSection", "CatalogFooter", "HomeBottomNav"];
  expect(order.map(name => names.indexOf(name))).toEqual([...order.map(name => names.indexOf(name))].sort((a, b) => a - b));
  expect(node("DiscoverSection").props.newest.map((s: { id: number }) => s.id)).toEqual([2, 1]);
  expect(node("DiscoverSection").props.cardWidth).toBeLessThan(190);
});

test("search sends the trimmed query to the server and retains catalog-wide total", async () => {
  await mount();
  await act(async () => { node("HomeSearch").props.onChangeQuery("  salon recherché  "); });
  await act(async () => { vi.advanceTimersByTime(250); });
  expect(h.list).toHaveBeenLastCalledWith({ status: "approved", search: "salon recherché", limit: 20 });
  expect(node("SearchResults").props.total).toBe(85);
  expect(node("SearchResults").props.list).toEqual(salons);
  expect(root.root.findAllByType("DiscoverSection" as never)).toHaveLength(0);
});

test("public home stays visible while Clerk is loading", async () => {
  h.loaded = false;
  await mount();
  expect(node("HomeSearch")).toBeTruthy();
  expect(root.root.findAllByType("Redirect" as never)).toHaveLength(0);
});

test("preserves barber dashboard redirect unless explicitly browsing", async () => {
  Object.assign(h, { signedIn: true, role: "barber", user: { name: "Fixture" }, path: "/" });
  await mount();
  expect(node("Redirect").props.href).toBe("/(barber)");
  h.path = "/browse";
  await act(async () => root.update(<PublicHome />));
  expect(node("HomeSearch")).toBeTruthy();
});

test("category selection is forwarded to discovery without filtering the global search", async () => {
  await mount();
  await act(async () => node("CategoryRow").props.onSelect(12, "Catégorie réelle"));
  expect(node("DiscoverSection").props.categoryId).toBe(12);
  expect(node("DiscoverSection").props.categoryName).toBe("Catégorie réelle");
  expect(h.list).toHaveBeenLastCalledWith({ status: "approved", search: undefined, limit: 20 });
});

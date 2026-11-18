import React from "react";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, afterEach, expect, test, vi } from "vitest";

const h = vi.hoisted(() => ({
  gps: vi.fn(), requestPermission: vi.fn(), refetch: vi.fn(),
  permission: { granted: true, canAskAgain: true },
  error: false,
}));
vi.mock("expo-location", () => ({
  useForegroundPermissions: () => [h.permission, h.requestPermission],
  getCurrentPositionAsync: h.gps, Accuracy: { Balanced: 3 },
}));
vi.mock("@workspace/api-client-react", () => ({
  useApprovedSalonCatalog: () => ({
    data: h.error ? [] : [
      { id: 1, salonName: "At position", latitude: 0, longitude: 0 },
      { id: 2, salonName: "One kilometer", latitude: 0, longitude: 0.009 },
      { id: 3, salonName: "Eight kilometers", latitude: 0, longitude: 0.072 },
    ],
    isLoading: false, isError: h.error, refetch: h.refetch,
  }),
  useListServiceCategories: () => ({ data: [] }),
}));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => ({ t: {}, user: { latitude: 50, longitude: 50 } }) }));
vi.mock("expo-router", async () => {
  const React = await import("react");
  return {
    useRouter: () => ({ back: vi.fn(), push: vi.fn() }), Stack: { Screen: "StackScreen" },
    useFocusEffect: (cb: () => void) => React.useEffect(cb, [cb]),
  };
});
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock("@expo/vector-icons", () => ({ Feather: "Icon" }));
vi.mock("react-native-webview", () => ({ WebView: "WebView" }));
vi.mock("react-native", () => ({
  ...Object.fromEntries(["ActivityIndicator", "FlatList", "Pressable", "ScrollView", "Text", "View"].map((s) => [s, s])),
  Platform: { OS: "native" }, Linking: { openSettings: vi.fn(async () => {}) },
}));

import MapScreen from "../app/map";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReactTestRenderer;
async function mount() { await act(async () => { root = TestRenderer.create(<MapScreen />); }); }
function payload() {
  const html = root.root.findByType("WebView" as never).props.source.html as string;
  return JSON.parse(html.match(/var data = (.*);/)![1]);
}
function text() { return root.root.findAllByType("Text" as never).map((n) => n.children.join("")).join("\n"); }
beforeEach(() => {
  vi.clearAllMocks();
  h.error = false;
  h.permission = { granted: true, canAskAgain: true };
  h.requestPermission.mockResolvedValue(h.permission);
  h.gps.mockResolvedValue({ coords: { latitude: 0, longitude: 0 } });
});
afterEach(async () => { await act(async () => root.unmount()); });

test("automatically centers on actual GPS, not the profile's saved coordinates or the first salon", async () => {
  await mount();
  expect(h.requestPermission).toHaveBeenCalledTimes(1);
  expect(h.gps).toHaveBeenCalledTimes(1);
  expect(payload()).toMatchObject({ center: [0, 0], userPosition: [0, 0], radiusM: 5000 });
  expect(payload().markers.map((m: { id: number }) => m.id)).toEqual([1, 2]);
  const html = root.root.findByType("WebView" as never).props.source.html as string;
  expect(html).toContain("if (!data.userPosition && data.markers.length > 0)");
});
test("radius changes filter around the user, not the map's visible area", async () => {
  await mount();
  await act(async () => root.root.findByProps({ testID: "map-radius-10" }).props.onPress());
  expect(payload().radiusM).toBe(10000);
  expect(payload().markers).toHaveLength(3);
  await act(async () => root.root.findByProps({ testID: "map-radius-2" }).props.onPress());
  expect(payload().markers).toHaveLength(2);
  expect(h.gps).toHaveBeenCalledTimes(1);
});
test("denied GPS never displays a fabricated user position and still allows all salons", async () => {
  h.permission = { granted: false, canAskAgain: true };
  h.requestPermission.mockResolvedValue(h.permission);
  await mount();
  expect(h.gps).not.toHaveBeenCalled();
  expect(root.root.findAllByType("WebView" as never)).toHaveLength(0);
  expect(text()).toContain("Localisation nécessaire");
  expect(text()).not.toContain("0 salon trouvé");
  await act(async () => root.root.findByProps({ testID: "map-show-all" }).props.onPress());
  expect(payload().userPosition).toBeNull();
  expect(payload().markers).toHaveLength(3);
});
test("an API error offers retry without falsely announcing zero nearby salons", async () => {
  h.error = true;
  await mount();
  expect(text()).toContain("Chargement impossible");
  expect(text()).not.toContain("0 salon trouvé");
  h.refetch.mockClear();
  await act(async () => root.root.findByProps({ testID: "map-retry-salons" }).props.onPress());
  expect(h.refetch).toHaveBeenCalledTimes(1);
});
test("a GPS request completing late does not override a deliberate all-salons selection", async () => {
  let resolve!: (value: unknown) => void;
  h.gps.mockReturnValueOnce(new Promise((yes) => { resolve = yes; }));
  await mount();
  await act(async () => root.root.findByProps({ testID: "map-show-all" }).props.onPress());
  await act(async () => { resolve({ coords: { latitude: 0, longitude: 0 } }); });
  expect(payload().showRadius).toBe(false);
  expect(payload().markers).toHaveLength(3);
});

test("salon markers use fixed-size vector pins with accessible names and selection feedback", async () => {
  await mount();
  const html = root.root.findByType("WebView" as never).props.source.html as string;
  expect(html).toContain("iconSize: [44,54]");
  expect(html).toContain("iconAnchor: [22,48]");
  expect(html).toContain('<svg viewBox="0 0 24 24"');
  expect(html).toContain("alt: 'Salon : ' + m.name");
  expect(html).toContain("classList.add('is-selected')");
  expect(html).toContain("classList.remove('is-selected')");
  expect(html).not.toContain("\\u2702");
  const inline = html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
  expect(inline).toBeTruthy();
  expect(() => new Function(inline!)).not.toThrow();
});
test("a GPS failure is understandable and the user can retry without restarting", async () => {
  h.gps.mockRejectedValueOnce(new Error("Location unavailable"));
  await mount();
  expect(text()).toContain("Activez la localisation");
  expect(text()).not.toContain("0 salon trouvé");
  await act(async () => root.root.findByProps({ testID: "map-locate-me" }).props.onPress());
  expect(payload().userPosition).toEqual([0, 0]);
  expect(h.gps).toHaveBeenCalledTimes(2);
});
test("leaving the map before permission resolves does not start a background GPS request", async () => {
  let resolve!: (value: unknown) => void;
  h.requestPermission.mockReturnValueOnce(new Promise((yes) => { resolve = yes; }));
  await mount();
  await act(async () => root.unmount());
  await act(async () => { resolve({ granted: true }); });
  expect(h.gps).not.toHaveBeenCalled();
});

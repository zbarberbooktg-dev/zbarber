import React from "react";
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { afterAll, afterEach, beforeEach, expect, test, vi } from "vitest";
import colors from "../constants/colors";

const h = vi.hoisted(() => ({
  preference: "light" as "light" | "dark" | "system",
  system: "light" as "light" | "dark" | null,
  loading: false,
  services: true,
  signedIn: true,
  fetcher: vi.fn(async () => ({})),
  push: vi.fn(),
  alert: vi.fn(),
  openURL: vi.fn(),
}));

// Metro normally resolves bundled images; Node only needs stable asset identities.
const restoreImages = await vi.hoisted(async () => {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const previous = require.extensions[".png"];
  require.extensions[".png"] = (module, filename) => { module.exports = filename; };
  return () => {
    if (previous) require.extensions[".png"] = previous;
    else delete require.extensions[".png"];
  };
});
afterAll(restoreImages);

vi.mock("react-native", () => ({
  ...Object.fromEntries(["ActivityIndicator", "Pressable", "ScrollView", "Text", "View"].map(s => [s, s])),
  Platform: { OS: "ios", select: (values: any) => values.ios ?? values.default },
  UIManager: {},
  LayoutAnimation: { configureNext: vi.fn(), Presets: { easeInEaseOut: {} } },
  Linking: { openURL: h.openURL },
  Alert: { alert: h.alert },
  Share: { share: vi.fn() },
  useColorScheme: () => h.system,
}));
vi.mock("@/contexts/AppContext", () => ({
  useApp: () => ({ themePref: h.preference, locale: "fr", t: { galleryWorks: "Réalisations" } }),
}));
vi.mock("@clerk/expo", () => ({ useAuth: () => ({ isSignedIn: h.signedIn }) }));
vi.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "1" }),
  useRouter: () => ({ push: h.push, back: vi.fn(), replace: vi.fn() }),
  Stack: { Screen: "StackScreen" },
}));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34 }) }));
vi.mock("@expo/vector-icons", () => ({ Feather: "Icon" }));
vi.mock("expo-image", () => ({ Image: "Image" }));
vi.mock("expo-location", () => ({}));
vi.mock("@/lib/api", () => ({ useAuthedFetch: () => h.fetcher }));
vi.mock("@/lib/imageUpload", () => ({ resolveObjectUrl: (url: string) => url }));
vi.mock("@/components/LocationPickerMap", () => ({ LocationPickerMap: "LocationPickerMap" }));
vi.mock("@/components/DateTimePicker", () => ({ DateTimePicker: "DateTimePicker" }));
vi.mock("@/components/ShimmerImage", () => ({ ShimmerImage: "ShimmerImage" }));
vi.mock("@/components/SalonPhotoGallery", () => ({ SalonPhotoGallery: "SalonPhotoGallery" }));
vi.mock("@/components/GalleryLightbox", () => ({ GalleryLightbox: "GalleryLightbox" }));
vi.mock("@/components/PanoramaViewer", () => ({ PanoramaViewer: "PanoramaViewer" }));
vi.mock("@/components/ScrollHint", () => ({ ScrollHint: "ScrollHint" }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === "availability"
      ? [{ date: "2026-11-20", isWorking: true, slots: [{ time: "10:00", iso: "2026-11-20T10:00:00Z", available: true }] }]
      : { enabled: false },
  }),
}));
vi.mock("@workspace/api-client-react", () => ({
  useGetBarber: () => ({
    isLoading: h.loading,
    data: h.loading ? undefined : {
      id: 1, salonName: "Salon témoin", phone: "+000000000",
      address: "Rue du salon", city: "Ville", latitude: "1", longitude: "2",
    },
  }),
  useListBarberServices: () => ({ data: h.services
    ? [{ id: 10, name: "Coupe", price: 100, duration: 30, isActive: true }] : [] }),
  useGetBarberGallery: () => ({ data: [{ id: 1, photoUrl: "/photo.jpg" }] }),
  useGetBarberSchedule: () => ({ data: { workDays: [{ day: "monday", isWorking: true, startTime: "09:00", endTime: "18:00" }] } }),
  useListReviews: () => ({ data: { data: [{ id: 1, rating: 5, clientId: 2, comment: "Très bien" }] } }),
  useListFavorites: () => ({ data: [], refetch: vi.fn() }),
  useAddFavorite: () => ({ mutateAsync: vi.fn() }),
  useRemoveFavorite: () => ({ mutateAsync: vi.fn() }),
  useGetMyLoyalty: () => ({ data: null }),
  useListBarberRealisations: () => ({ data: [] }),
  useListBarberPanoramas: () => ({ data: [] }),
}));

import SalonDetail from "../app/salon/[id]";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReactTestRenderer;
async function mount() {
  await act(async () => { root = TestRenderer.create(<SalonDetail />); });
}
const nodes = (type: string) => root.root.findAllByType(type as never);
const text = (value: string) => nodes("Text").find(n => n.children.join("") === value)!;
function button(label: string): ReactTestInstance {
  return nodes("Pressable").find(node => node.findAllByType("Text" as never)
    .some(child => child.children.join("") === label))!;
}
const style = (node: ReactTestInstance) => typeof node.props.style === "function"
  ? node.props.style({ pressed: false }) : node.props.style;
const contrast = (a: string, b: string) => {
  const luminance = (hex: string) => {
    const [r, g, b] = hex.slice(1).match(/../g)!.map(c => {
      const v = parseInt(c, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [min, max] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (max + 0.05) / (min + 0.05);
};
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(h, { preference: "light", system: "light", loading: false, services: true, signedIn: true });
});
afterEach(async () => { if (root) await act(async () => root.unmount()); });

test.each([
  ["light", "dark", "light"],
  ["dark", "light", "dark"],
  ["system", "light", "light"],
  ["system", "dark", "dark"],
  ["system", null, "light"],
] as const)("%s preference with %s system themes the whole salon as %s", async (pref, system, effective) => {
  h.preference = pref; h.system = system;
  await mount();
  const C = colors[effective];
  expect(style(nodes("View")[0]).backgroundColor).toBe(C.background);
  expect(style(text("Horaires d'ouverture")).color).toBe(C.foreground);
  expect(style(text("Avis clients")).color).toBe(C.foreground);
  const gallery = nodes("SalonPhotoGallery")[0];
  expect(gallery.props.colors).toMatchObject({
    bg: C.background, surface: C.card, text: C.foreground, textMuted: C.mutedForeground,
  });
    const booking = button("Réserver");
  expect(style(booking).backgroundColor).toBe(C.primary);
  expect(contrast(style(booking.findByType("Text" as never)).color, C.primary)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(C.mutedForeground, C.background)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(C.accentForeground, C.accent)).toBeGreaterThanOrEqual(4.5);
});

test("system and explicit theme changes preserve the salon page and booking navigation", async () => {
  h.preference = "system";
  await mount();
  for (const [preference, system, expected] of [
    ["system", "dark", "dark"], ["light", "dark", "light"], ["dark", "light", "dark"],
  ] as const) {
    h.preference = preference; h.system = system;
    await act(async () => root.update(<SalonDetail />));
    expect(style(nodes("View")[0]).backgroundColor).toBe(colors[expected].background);
    expect(text("Salon témoin")).toBeTruthy();
  }
  await act(async () => button("Réserver").props.onPress());
  expect(h.push).toHaveBeenCalledWith({ pathname: "/salon/[id]/reservation", params: { id: "1" } });
});

test.each(["light", "dark"] as const)("loading state honors the %s theme before salon data arrives", async pref => {
  h.preference = pref; h.loading = true;
  await mount();
  expect(style(nodes("View")[0]).backgroundColor).toBe(colors[pref].background);
  expect(nodes("ActivityIndicator")[0].props.color).toBe(colors[pref].accentForeground);
});

test.each(["light", "dark"] as const)("phone-only salon keeps readable contact controls in %s mode", async pref => {
  h.preference = pref; h.services = false;
  await mount();
  expect(style(text("Appeler le salon")).color).toBe(colors[pref].accentForeground);
  await act(async () => button("Appeler le salon").props.onPress());
  expect(h.openURL).toHaveBeenCalledWith("tel:+000000000");
});

test("signed-out visitors can open the guided booking page", async () => {
  h.signedIn = false;
  await mount();
  await act(async () => button("Réserver").props.onPress());
  expect(h.push).toHaveBeenCalledWith({ pathname: "/salon/[id]/reservation", params: { id: "1" } });
});

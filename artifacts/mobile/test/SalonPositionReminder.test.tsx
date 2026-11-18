import React from "react";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { coordinates } from "../lib/salonSearch";
import { hasSalonPosition } from "../../admin/src/lib/salonLocation";

const h = vi.hoisted(() => ({
  salons: [] as Array<Record<string, unknown>>,
  mutate: vi.fn(),
}));
vi.mock("@workspace/api-client-react", () => ({
  getGetMyBarbersQueryKey: () => ["/api/barbers/me"],
  useGetMyBarbers: () => useQuery({ queryKey: ["/api/barbers/me"], queryFn: async () => h.salons }),
  useUpdateMySalon: () => ({ mutateAsync: h.mutate }),
}));
vi.mock("@/lib/api", () => ({ useAuthedFetch: () => vi.fn() }));
vi.mock("@/lib/imageUpload", () => ({ pickAndUploadImage: vi.fn(), resolveObjectUrl: () => null }));
vi.mock("@/contexts/AppContext", () => ({
  useApp: () => ({ lang: "fr", t: {}, user: { name: "Owner" }, selectedSalonId: 2 }),
}));
vi.mock("expo-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@expo/vector-icons", () => ({ Feather: "Icon" }));
vi.mock("@/hooks/useColors", () => ({ useColors: () => ({ radius: 8 }) }));
vi.mock("react-native", () => ({
  ...Object.fromEntries(["ActivityIndicator", "Image", "Modal", "Pressable", "ScrollView", "Text", "TextInput", "View"].map((s) => [s, s])),
}));
vi.mock("@/components/UI", () => ({ Card: "Card", Button: "Button", Avatar: "Avatar" }));
vi.mock("@/components/DeleteAccountModal", () => ({ DeleteAccountModal: "DeleteAccountModal" }));
vi.mock("@/components/DocumentUploadCard", () => ({ DocumentUploadCard: "DocumentUploadCard" }));
vi.mock("@/components/SignOutButton", () => ({ SignOutButton: "SignOutButton" }));
vi.mock("@/components/EditProfileModal", () => ({ EditProfileModal: "EditProfileModal" }));
vi.mock("@/components/KeyboardAwareScrollViewCompat", () => ({ KeyboardAwareScrollViewCompat: "KeyboardScroll" }));
vi.mock("@/components/CountryCityFields", () => ({ CountryCityFields: "CountryCityFields" }));
vi.mock("@/components/SalonLocationFields", () => ({
  SalonLocationFields: "SalonLocationFields",
  validCoordinates: (lat: unknown, lng: unknown) => typeof lat === "number" && typeof lng === "number" && !!coordinates(lat, lng),
}));

import BarberProfile from "../app/(barber)/profile";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReactTestRenderer | undefined;
let qc: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  h.salons = [
    { id: 1, salonName: "First salon", latitude: null, longitude: null, country: "Togo", city: "Lomé" },
    { id: 2, salonName: "Second salon", latitude: 95, longitude: 0, country: "Togo", city: "Lomé" },
    { id: 3, salonName: "Zero salon", latitude: 0, longitude: 0, country: "Togo", city: "Lomé" },
  ];
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  h.mutate.mockImplementation(async ({ params, data }) => {
    h.salons = h.salons.map((salon) => salon.id === params.salonId ? { ...salon, ...data } : salon);
    return h.salons.find((salon) => salon.id === params.salonId);
  });
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  qc.clear();
});
async function mount() {
  qc.setQueryData(["/api/barbers/me"], h.salons);
  await act(async () => {
    root = TestRenderer.create(<QueryClientProvider client={qc}><BarberProfile /></QueryClientProvider>);
  });
}
const find = (id: string) => root!.root.findByProps({ testID: id });

test.each([
  [null, null, false], [undefined, 1, false], [1, null, false],
  [91, 0, false], [0, -181, false], [NaN, 0, false], [0, Infinity, false],
  ["", "", false], ["  ", 0, false], [false, 0, false], ["oops", "0", false],
  [0, 0, true], [0, 1, true], [-90, 180, true], ["0", "0", true],
])("map and admin agree on position validity (%s, %s)", (lat, lng, valid) => {
  expect(!!coordinates(lat, lng)).toBe(valid);
  expect(hasSalonPosition(lat, lng)).toBe(valid);
});

test("reminds each unlocated salon without blocking the profile or treating zero as missing", async () => {
  await mount();
  expect(find("salon-position-reminder-1")).toBeTruthy();
  expect(find("salon-position-reminder-2")).toBeTruthy();
  expect(root!.root.findAllByProps({ testID: "salon-position-reminder-3" })).toHaveLength(0);
  expect(root!.root.findAllByType("SignOutButton" as never)).toHaveLength(1);
  expect(h.mutate).not.toHaveBeenCalled();
});

test("opens the existing editor for the chosen salon and removes only its reminder after saving", async () => {
  await mount();
  await act(async () => find("salon-position-edit-2").props.onPress());
  expect(root!.root.findByType("SalonLocationFields" as never).props.value).toBeNull();
  expect(h.mutate).not.toHaveBeenCalled();
  await act(async () => root!.root.findByType("SalonLocationFields" as never).props.onChange({ latitude: 0, longitude: 0 }));
  await act(async () => find("salon-save").props.onPress());
  expect(h.mutate).toHaveBeenCalledWith(expect.objectContaining({
    params: { salonId: 2 }, data: expect.objectContaining({ latitude: 0, longitude: 0 }),
  }));
  expect(root!.root.findAllByProps({ testID: "salon-position-reminder-2" })).toHaveLength(0);
  expect(find("salon-position-reminder-1")).toBeTruthy();
  expect(root!.root.findAllByProps({ testID: "salon-save" })).toHaveLength(0);
  // Refetch and reopening use persisted values, not the previous invalid position.
  await act(async () => { await qc.invalidateQueries(); });
  await act(async () => find("edit-salon-2").props.onPress());
  expect(root!.root.findByType("SalonLocationFields" as never).props.value).toEqual({ latitude: 0, longitude: 0 });
});

test("a failed save keeps the reminder and editor available for retry", async () => {
  h.mutate.mockRejectedValueOnce(new Error("Network failure"));
  await mount();
  await act(async () => find("salon-position-edit-1").props.onPress());
  await act(async () => find("salon-save").props.onPress());
  expect(find("salon-position-reminder-1")).toBeTruthy();
  expect(find("salon-save")).toBeTruthy();
  expect(root!.root.findAllByType("Text" as never).some((n) => n.children.includes("Network failure"))).toBe(true);
});

test("saving other salon details never invents a position or clears a missing-position reminder", async () => {
  await mount();
  await act(async () => find("salon-position-edit-1").props.onPress());
  await act(async () => find("salon-save").props.onPress());
  const data = h.mutate.mock.calls[0][0].data;
  expect(data).not.toHaveProperty("latitude");
  expect(data).not.toHaveProperty("longitude");
  expect(find("salon-position-reminder-1")).toBeTruthy();
  expect(root!.root.findAllByProps({ testID: "salon-save" })).toHaveLength(0);
});

import React from "react";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const h = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  fetcher: vi.fn(async () => ({})),
  invalidate: vi.fn(),
}));

vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  Platform: { OS: "ios" },
  Pressable: "Pressable",
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("@clerk/expo", () => ({ useAuth: () => ({ isLoaded: true, isSignedIn: true, userId: "user-1" }) }));
vi.mock("@expo/vector-icons", () => ({ Feather: "Feather" }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    const result = queryKey[0] === "availability"
      ? { data: [{ date: "2099-06-15", isWorking: true, isBlocked: false, slots: [{ time: "10:30", iso: "2099-06-15T10:30:00.000Z", available: true }] }], isFetching: false, isError: false }
      : { data: { enabled: false }, isError: false };
    console.log("mock q", queryKey, result);
    return result;
  },
  useQueryClient: () => ({ invalidateQueries: h.invalidate }),
}));
vi.mock("@workspace/api-client-react", () => ({
  getListReservationsQueryKey: () => ["/api/reservations"],
  useGetBarber: () => ({ data: { salonName: "Salon Témoin", address: "Rue de Lomé", city: "Lomé" } }),
  useListBarberServices: () => ({ data: [{ id: 7, name: "Coupe classique", description: "Coupe et finition", price: 1000, durationMinutes: 30, isActive: true }] }),
}));
vi.mock("expo-location", () => ({}));
vi.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "3" }),
  useRouter: () => ({ push: h.push, replace: h.replace, back: vi.fn() }),
}));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ bottom: 20 }) }));
vi.mock("@/components/DateTimePicker", () => ({
  DateTimePicker: ({ onChange }: { onChange: (value: string) => void }) =>
    React.createElement("Pressable", { testID: "date-picker", onPress: () => onChange("2099-06-15T10:30:00.000Z") },
      React.createElement("Text", null, "Disponibilités")),
}));
vi.mock("@/components/KeyboardAwareScrollViewCompat", () => ({ KeyboardAwareScrollViewCompat: "ScrollView" }));
vi.mock("@/components/LocationPickerMap", () => ({ LocationPickerMap: "LocationPickerMap" }));
vi.mock("@/contexts/AppContext", () => ({
  useApp: () => ({
    lang: "fr", locale: "fr-FR", signingOut: false,
    t: { hsModeSalon: "Au salon", hsModeHome: "À domicile", hsLocating: "Localisation…", hsUseMyLocation: "Ma position", hsMapHint: "Déplacer le repère", hsOutOfRange: "Hors zone", hsQuoteDistance: "Distance", hsQuoteFee: "Frais" },
  }),
}));
vi.mock("@/hooks/useColors", () => ({
  useColors: () => ({ foreground: "#111111", background: "#ffffff", card: "#f5f5f5", border: "#cccccc", mutedForeground: "#555555", accent: "#fef3c7", primary: "#b57900", primaryForeground: "#ffffff", destructive: "#cc0000", success: "#008800", secondary: "#eeeeee", radius: 12, isDark: false }),
}));
vi.mock("@/lib/api", () => ({ useAuthedFetch: () => h.fetcher }));

import Screen from "../app/salon/[id]/reservation";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReactTestRenderer;
const byId = (id: string) => root.root.findByProps({ testID: id });
const renderedText = () => root.root.findAllByType("Text" as never).map((node) => node.children.join(""));

beforeEach(() => {
  vi.clearAllMocks();
  h.fetcher.mockResolvedValue({});
});
afterEach(async () => { if (root) await act(async () => root.unmount()); });

test("guides the client through service, time and recap before sending a booking", async () => {
  await act(async () => { root = TestRenderer.create(<Screen />); });
  expect(renderedText()).toContain("Choisir une prestation");
  expect(renderedText()).toContain("Préciser le lieu");
  expect(renderedText()).toContain("Choisir une date et une heure");
  expect(renderedText()).toContain("Vérifier et envoyer");
  expect(byId("reservation-submit").props.accessibilityState.disabled).toBe(true);

  await act(async () => byId("reservation-service-7").props.onPress());
  await act(async () => byId("date-picker").props.onPress());
  expect(byId("reservation-submit").props.accessibilityState.disabled).toBe(false);
  await act(async () => byId("reservation-submit").props.onPress());

  expect(h.fetcher).toHaveBeenCalledWith("/api/reservations", {
    method: "POST",
    body: JSON.stringify({ barberId: 3, serviceId: 7, scheduledAt: "2099-06-15T10:30:00.000Z" }),
  });
  expect(renderedText()).toContain("Demande envoyée");
  expect(h.invalidate).toHaveBeenCalled();
});

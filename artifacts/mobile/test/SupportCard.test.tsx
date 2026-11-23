import React from "react";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, test, vi } from "vitest";

const h = vi.hoisted(() => ({
  push: vi.fn(), open: vi.fn(async (_url: string) => {}), refetch: vi.fn(),
  data: undefined as undefined | { whatsapp: string | null; instagram: string | null; facebook: string | null; tiktok: string | null },
  error: false,
}));
vi.mock("@workspace/api-client-react", () => ({
  getGetSupportLinksQueryKey: () => ["/api/support/links"],
  useGetSupportLinks: () => ({ data: h.data, isLoading: false, isError: h.error, refetch: h.refetch }),
}));
vi.mock("expo-router", () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock("@expo/vector-icons", () => ({ Feather: "Icon" }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => ({ lang: "fr", t: {} }) }));
vi.mock("@/hooks/useColors", () => ({ useColors: () => ({ radius: 14 }) }));
vi.mock("react-native", () => ({
  View: "View", Text: "Text", Pressable: "Pressable", ActivityIndicator: "ActivityIndicator",
  Alert: { alert: vi.fn() }, Linking: { openURL: h.open },
}));

import { SupportCard } from "../components/SupportCard";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReactTestRenderer;
const find = (key: string) => root.root.findByProps({ testID: `support-row-${key}` });

async function mount() {
  await act(async () => { root = TestRenderer.create(<SupportCard />); });
}
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  h.data = undefined;
  h.error = false;
  vi.clearAllMocks();
});

test("opens the configured WhatsApp number and social links, without inventing missing links", async () => {
  h.data = { whatsapp: "+22890123456", instagram: "https://instagram.com/zbarber", tiktok: null, facebook: null };
  await mount();
  await act(async () => find("whatsapp").props.onPress());
  await act(async () => find("instagram").props.onPress());
  expect(h.open.mock.calls).toEqual([["https://wa.me/22890123456"], ["https://instagram.com/zbarber"]]);
  expect(root.root.findAllByProps({ testID: "support-row-tiktok" })).toHaveLength(0);
  expect(root.root.findAllByProps({ testID: "support-row-facebook" })).toHaveLength(0);
});

test("keeps ticket and legal navigation available when configured links cannot load", async () => {
  h.error = true;
  await mount();
  await act(async () => find("ticket").props.onPress());
  await act(async () => find("privacy").props.onPress());
  await act(async () => find("terms").props.onPress());
  await act(async () => root.root.findByProps({ testID: "support-links-retry" }).props.onPress());
  expect(h.push.mock.calls).toEqual([["/support"], ["/legal/privacy"], ["/legal/terms"]]);
  expect(h.refetch).toHaveBeenCalledOnce();
});

import React from "react";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { translations } from "../constants/i18n";

const h = vi.hoisted(() => ({ fetcher: vi.fn(), signOut: vi.fn(), app: {} }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => h.app }));
vi.mock("@/lib/api", () => ({ useAuthedFetch: () => h.fetcher }));
vi.mock("@workspace/zbarber-design/hooks/use-colors", () => ({ useColors: () => ({ radius: 8 }) }));
vi.mock("@expo/vector-icons", () => ({ Feather: "Icon" }));
vi.mock("@/components/KeyboardAwareScrollViewCompat", () => ({ KeyboardAwareScrollViewCompat: "ScrollView" }));
vi.mock("react-native", () => Object.fromEntries(["ActivityIndicator", "Modal", "Pressable", "Text", "TextInput", "View"].map((name) => [name, name])));

import { DeleteAccountModal } from "../components/DeleteAccountModal";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReactTestRenderer;
let onClose = vi.fn<() => void>();
beforeEach(async () => {
  h.fetcher.mockReset().mockResolvedValue(null); // The API fetcher returns null for HTTP 204.
  h.signOut.mockReset().mockResolvedValue(undefined);
  h.app = { t: translations.fr, signOut: h.signOut };
  onClose = vi.fn<() => void>();
  await act(async () => { root = TestRenderer.create(<DeleteAccountModal visible onClose={onClose} />); });
  const inputs = root.root.findAllByType("TextInput" as never);
  await act(async () => { inputs.at(-1)!.props.onChangeText("SUPPRIMER"); });
});
afterEach(async () => { await act(async () => root.unmount()); });
function button(label: string) {
  return root.root.findAllByType("Pressable" as never).find((node) =>
    node.findAllByType("Text" as never).some((text) => text.children.join("") === label),
  )!;
}

test("a successful 204 deletion reaches logout; a logout retry must not delete the account twice", async () => {
  h.signOut.mockRejectedValueOnce(new Error("Déconnexion impossible"));
  await act(async () => { await button(translations.fr.deleteAccountConfirmBtn).props.onPress(); });
  expect(h.fetcher).toHaveBeenCalledWith("/api/auth/me", { method: "DELETE" });
  expect(h.fetcher).toHaveBeenCalledTimes(1);
  expect(h.signOut).toHaveBeenCalledWith({ destination: "/role-select" });
  expect(onClose).not.toHaveBeenCalled();
  expect(button(translations.fr.cancel).props.disabled).toBe(true);
  await act(async () => { await button("Réessayer la déconnexion").props.onPress(); });
  expect(h.fetcher).toHaveBeenCalledTimes(1);
  expect(h.signOut).toHaveBeenCalledTimes(2);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("immediate duplicate presses send only one delete request", async () => {
  let resolve!: (value: null) => void;
  h.fetcher.mockReturnValueOnce(new Promise((yes) => { resolve = yes; }));
  const submit = button(translations.fr.deleteAccountConfirmBtn);
  let first!: Promise<void>, second!: Promise<void>;
  await act(async () => { first = submit.props.onPress(); second = submit.props.onPress(); });
  expect(h.fetcher).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(null); await Promise.all([first, second]); });
  expect(h.signOut).toHaveBeenCalledTimes(1);
});

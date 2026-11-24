import React from "react";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("react-native", () => ({
  Text: "Text", View: "View", Pressable: "Pressable", ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (s: object) => s }, useColorScheme: () => "dark",
  Platform: { OS: "ios" },
}));
vi.mock("@expo/vector-icons", () => ({ Feather: "Icon" }));
vi.mock("@/components/SalonCardImage", () => ({ SalonCardImage: "SalonCardImage" }));
import { SalonCoverCard } from "../components/home/SalonCoverCard";
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReactTestRenderer;
afterEach(async () => { if (root) await act(async () => root.unmount()); });

test("does not invent missing ratings or distances and keeps a 4:3 cover", async () => {
  await act(async () => { root = TestRenderer.create(<SalonCoverCard salon={{ id: 7, salonName: "Fixture", rating: 0 }}
    width={168} favorite={false} favoriteBusy={false} onToggleFavorite={vi.fn()} onPress={vi.fn()} fr />); });
  const text = root.root.findAllByType("Text" as never).flatMap(n => n.children).join(" ");
  expect(text).not.toMatch(/km|mètres|5\.0|0\.0/);
  expect(root.root.findByType("SalonCardImage" as never).props.style).toMatchObject({ aspectRatio: 4 / 3, borderRadius: 16 });
});

test("shows actual rating and distance, and favorite cannot trigger salon navigation", async () => {
  const visit = vi.fn(), favorite = vi.fn();
  await act(async () => { root = TestRenderer.create(<SalonCoverCard salon={{ id: 7, salonName: "Fixture", rating: 4.7, reviewCount: 12 }}
    distanceKm={0.35} width={168} favorite favoriteBusy={false} onToggleFavorite={favorite} onPress={visit} fr testID="salon-7" />); });
  const toggle = root.root.findByProps({ testID: "salon-7-favorite" });
  expect(toggle.parent?.type).toBe("View");
  await act(async () => toggle.props.onPress());
  expect(favorite).toHaveBeenCalledOnce();
  expect(visit).not.toHaveBeenCalled();
  const text = root.root.findAllByType("Text" as never).flatMap(n => n.children).join(" ");
  expect(text).toContain("4.7");
  expect(text).toContain("(12)");
  expect(text).toContain("350 m");
});

import React from "react";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const h = vi.hoisted(() => ({
  players: [] as Array<{ muted: boolean; loop: boolean; status: string; play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn> }>,
  refetch: vi.fn(), push: vi.fn(), appChange: undefined as undefined | ((state: string) => void),
}));
const ads = [{ id: 1, salonId: 7, salonName: "Fixture salon", videoPath: "/api/salon-ads/1/video" }];
vi.mock("react-native", () => ({
  Text: "Text", View: "View", Pressable: "Pressable", ActivityIndicator: "ActivityIndicator", Modal: "Modal",
  Platform: { OS: "ios" }, StyleSheet: { create: (s: object) => s, absoluteFill: {}, absoluteFillObject: {} },
  useColorScheme: () => "dark", useWindowDimensions: () => ({ width: 414 }),
  AppState: { currentState: "active", addEventListener: (_: string, cb: (state: string) => void) => {
    h.appChange = cb; return { remove: vi.fn() };
  } },
  FlatList: (props: any) => React.createElement("FlatList", props, props.data.map((item: any) => props.renderItem({ item }))),
}));
vi.mock("@expo/vector-icons", () => ({ Feather: "Icon" }));
vi.mock("expo", () => ({ useEvent: () => ({ status: "readyToPlay" }) }));
vi.mock("expo-video", () => ({
  VideoView: "VideoView",
  useVideoPlayer: (_: unknown, setup: (p: any) => void) => React.useMemo(() => {
    const player = { muted: false, loop: false, status: "readyToPlay", play: vi.fn(), pause: vi.fn() };
    setup(player); h.players.push(player); return player;
  }, []),
}));
vi.mock("expo-router", () => ({
  useRouter: () => ({ push: h.push }),
  useFocusEffect: (cb: () => void) => React.useEffect(cb, [cb]),
}));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }) }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => ({ lang: "fr" }) }));
vi.mock("@/lib/api", () => ({ apiUrl: (path: string) => path }));
vi.mock("@/lib/imageUpload", () => ({ resolveObjectUrl: () => null }));
vi.mock("@/components/ShimmerImage", () => ({ ShimmerImage: "ShimmerImage" }));
vi.mock("@/components/home/SectionHeader", () => ({ SectionHeader: "SectionHeader" }));
vi.mock("@workspace/api-client-react", () => ({
  getListSalonAdsQueryKey: () => ["/api/salon-ads"],
  useListSalonAds: () => ({ data: ads, refetch: h.refetch }),
}));
import { SalonAdsCarousel } from "../components/SalonAdsCarousel";
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReactTestRenderer;
async function visibleAd() {
  await act(async () => { root = TestRenderer.create(<SalonAdsCarousel visible onLayout={vi.fn()} />); });
  const list = root.root.findByType("FlatList" as never);
  await act(async () => list.props.onViewableItemsChanged({ viewableItems: [{ isViewable: true, item: ads[0] }] }));
}
beforeEach(() => { vi.clearAllMocks(); h.players.length = 0; });
afterEach(async () => { if (root) await act(async () => root.unmount()); });

test("autoplays only the visible ad, muted by default, with icon-only sound control", async () => {
  await visibleAd();
  expect(h.players).toHaveLength(1);
  expect(h.players[0].muted).toBe(true);
  expect(h.players[0].play).toHaveBeenCalled();
  const sound = root.root.findByProps({ testID: "ad-toggle-sound" });
  expect(sound.props.accessibilityLabel).toBe("Activer le son");
  expect(sound.findAllByType("Text" as never)).toHaveLength(0);
  await act(async () => sound.props.onPress());
  expect(h.players[0].muted).toBe(false);
  await act(async () => root.update(<SalonAdsCarousel visible={false} onLayout={vi.fn()} />));
  expect(root.root.findAllByType("VideoView" as never)).toHaveLength(0);
});

test("preserves pause when returning to the ad and stops video in background", async () => {
  await visibleAd();
  const pause = root.root.findByProps({ accessibilityLabel: "Mettre la publicité en pause" });
  await act(async () => pause.props.onPress());
  expect(h.players[0].pause).toHaveBeenCalled();
  await act(async () => h.appChange?.("background"));
  expect(root.root.findAllByType("VideoView" as never)).toHaveLength(0);
  await act(async () => h.appChange?.("active"));
  expect(root.root.findByProps({ accessibilityLabel: "Reprendre la publicité" })).toBeTruthy();
  expect(h.players.at(-1)?.play).not.toHaveBeenCalled();
});

import React from "react";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, test, vi } from "vitest";

const h = vi.hoisted(() => ({ scroll: vi.fn() }));
vi.mock("@expo/vector-icons", () => ({ Feather: "Icon" }));
vi.mock("expo-image", () => ({ Image: "Image" }));
vi.mock("@/components/ShimmerImage", () => ({ ShimmerImage: "ShimmerImage" }));
vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    View: "View", Text: "Text", Pressable: "Pressable",
    useWindowDimensions: () => ({ width: 414, height: 896 }),
    FlatList: React.forwardRef(function MockList(props: any, ref) {
      React.useImperativeHandle(ref, () => ({ scrollToOffset: h.scroll }));
      return React.createElement("List", props, props.data.map((item: any, index: number) =>
        React.createElement(React.Fragment, { key: item.key }, props.renderItem({ item, index }))));
    }),
  };
});

import { SalonPhotoGallery } from "../components/SalonPhotoGallery";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReactTestRenderer;
const open = vi.fn();
const colors = { bg: "black", surface: "gray", border: "silver", text: "white", textMuted: "gray", gold: "gold" };
const slides = [{ key: "one", source: { uri: "/one.jpg" } }, { key: "two", source: { uri: "/two.jpg" } }];
async function mount(count = 2, isFr = true) {
  open.mockClear(); h.scroll.mockClear();
  await act(async () => { root = TestRenderer.create(
    <SalonPhotoGallery slides={slides.slice(0, count)} isGallery={count > 1} isFr={isFr} colors={colors} onOpen={open} />,
  ); });
}
afterEach(async () => { if (root) await act(async () => root.unmount()); });
const find = (testID: string) => root.root.findByProps({ testID });

test("shows taller, complete photos with no bottom overlay", async () => {
  await mount();
  const photos = root.root.findAllByType("ShimmerImage" as never);
  expect(photos).toHaveLength(2);
  expect(photos[0].props.contentFit).toBe("contain");
  expect(photos[0].props.style).toMatchObject({ width: 414, height: 435 });
  expect(root.root.findAllByType("View" as never).some(node =>
    node.props.style?.position === "absolute")).toBe(false);
});

test("thumbnail selection scrolls the carousel and opens the matching full-screen photo", async () => {
  await mount();
  await act(async () => find("salon-photo-thumb-1").props.onPress());
  expect(h.scroll).toHaveBeenCalledWith({ offset: 414, animated: true });
  expect(find("salon-photo-thumb-1").props.accessibilityState.selected).toBe(true);
  await act(async () => find("salon-photo-expand").props.onPress());
  expect(open).toHaveBeenLastCalledWith(1);
  await act(async () => find("salon-photo-0").props.onPress());
  expect(open).toHaveBeenLastCalledWith(0);
});

test("swiping updates the selected thumbnail", async () => {
  await mount();
  await act(async () => root.root.findAllByType("List" as never)[0].props.onScroll({
    nativeEvent: { contentOffset: { x: 414 } },
  }));
  expect(find("salon-photo-thumb-1").props.accessibilityState.selected).toBe(true);
});

test("a single fallback image stays expandable without unnecessary thumbnails", async () => {
  await mount(1, false);
  expect(root.root.findAllByType("List" as never)).toHaveLength(1);
  expect(find("salon-photo-expand").props.accessibilityLabel).toBe("View full screen");
  await act(async () => find("salon-photo-expand").props.onPress());
  expect(open).toHaveBeenCalledWith(0);
});

test("uses actual container width for photo sizing and thumbnail navigation", async () => {
  await mount();
  await act(async () => find("salon-photo-gallery").props.onLayout({ nativeEvent: { layout: { width: 375 } } }));
  expect(root.root.findAllByType("ShimmerImage" as never)[0].props.style.width).toBe(375);
  await act(async () => find("salon-photo-thumb-1").props.onPress());
  expect(h.scroll).toHaveBeenLastCalledWith({ offset: 375, animated: true });
});

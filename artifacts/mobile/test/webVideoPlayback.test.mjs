import { expect, test, vi } from "vitest";
import { playWebVideo } from "../lib/webVideoPlayback";

test("expected cancellation on remount never becomes an unhandled rejection", async () => {
  const failed = vi.fn();
  await playWebVideo({ play: () => Promise.reject(new DOMException("Media removed", "AbortError")) }, failed);
  expect(failed).not.toHaveBeenCalled();
});
test.each(["NotAllowedError", "NotSupportedError"])("surfaces %s so the UI can offer play or an error", async name => {
  const failed = vi.fn(), error = new DOMException("Browser rejected playback", name);
  await playWebVideo({ play: () => Promise.reject(error) }, failed);
  expect(failed).toHaveBeenCalledWith(error);
});

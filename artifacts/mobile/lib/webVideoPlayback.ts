/** A media element can be removed/paused while its asynchronous play is pending. */
export async function playWebVideo(
  video: { play: () => Promise<void> },
  onFailure: (error: unknown) => void,
) {
  try {
    await video.play();
  } catch (error) {
    // Expected on an inline/full-screen remount or viewport-driven unmount.
    if (error && typeof error === "object" && "name" in error && error.name === "AbortError") return;
    onFailure(error);
  }
}

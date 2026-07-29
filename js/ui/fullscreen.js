export function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
  } else {
    document.documentElement.requestFullscreen?.().catch(() => {
      // Ignore - browser may block fullscreen without a direct user gesture
      // or the API may be unsupported; the button simply won't do anything.
    });
  }
}

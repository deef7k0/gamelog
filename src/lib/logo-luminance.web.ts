/**
 * The web build's `measureLogoLuminance`: no measurement.
 *
 * Skia on the web needs CanvasKit — a multi-megabyte WASM binary loaded before
 * anything draws — and the app does not ship it there (CLAUDE.md). An
 * unmeasured logo is drawn as a light silhouette, which is legible on any
 * immersive page; the colours are the one thing the web build loses.
 */
export async function measureLogoLuminance(_url: string): Promise<number | null> {
  return null;
}

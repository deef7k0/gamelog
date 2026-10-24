/**
 * keyColorUtils.ts
 *
 * Color manipulation utilities for Apple Music-style dynamic hero transitions.
 * Converts hex keyColor to gradient stops, tint overlays, and contrast-checked tones.
 */

/**
 * Converts a 3, 6, or 8 digit hex color to an RGBA color string.
 *
 * @param hex - Hexadecimal color string (e.g. "#1a0a2e" or "1a0a2e")
 * @param alpha - Opacity value between 0 and 1
 */
export function hexToRgba(hex: string, alpha: number): string {
  'worklet';
  const clean = hex.replace('#', '').trim();
  const clampedAlpha = Math.max(0, Math.min(1, alpha));

  let r = 0;
  let g = 0;
  let b = 0;

  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16) || 0;
    g = parseInt(clean[1] + clean[1], 16) || 0;
    b = parseInt(clean[2] + clean[2], 16) || 0;
  } else if (clean.length === 6 || clean.length === 8) {
    r = parseInt(clean.substring(0, 2), 16) || 0;
    g = parseInt(clean.substring(2, 4), 16) || 0;
    b = parseInt(clean.substring(4, 6), 16) || 0;
  }

  return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`;
}

/**
 * Darkens a hex color by scaling its RGB values towards 0.
 *
 * @param hex - Source hex color
 * @param factor - Factor between 0 (original) and 1 (black)
 */
export function darkenColor(hex: string, factor: number): string {
  'worklet';
  const clean = hex.replace('#', '').trim();
  const f = Math.max(0, Math.min(1, factor));

  let r = 0;
  let g = 0;
  let b = 0;

  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16) || 0;
    g = parseInt(clean[1] + clean[1], 16) || 0;
    b = parseInt(clean[2] + clean[2], 16) || 0;
  } else {
    r = parseInt(clean.substring(0, 2), 16) || 0;
    g = parseInt(clean.substring(2, 4), 16) || 0;
    b = parseInt(clean.substring(4, 6), 16) || 0;
  }

  const darkR = Math.round(r * (1 - f));
  const darkG = Math.round(g * (1 - f));
  const darkB = Math.round(b * (1 - f));

  const hexR = darkR.toString(16).padStart(2, '0');
  const hexG = darkG.toString(16).padStart(2, '0');
  const hexB = darkB.toString(16).padStart(2, '0');

  return `#${hexR}${hexG}${hexB}`;
}

/**
 * Lightens a hex color by blending its RGB values towards white (255).
 *
 * @param hex - Source hex color
 * @param factor - Factor between 0 (original) and 1 (white)
 */
export function lightenColor(hex: string, factor: number): string {
  'worklet';
  const clean = hex.replace('#', '').trim();
  const f = Math.max(0, Math.min(1, factor));

  let r = 0;
  let g = 0;
  let b = 0;

  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16) || 0;
    g = parseInt(clean[1] + clean[1], 16) || 0;
    b = parseInt(clean[2] + clean[2], 16) || 0;
  } else {
    r = parseInt(clean.substring(0, 2), 16) || 0;
    g = parseInt(clean.substring(2, 4), 16) || 0;
    b = parseInt(clean.substring(4, 6), 16) || 0;
  }

  const lightR = Math.round(r + (255 - r) * f);
  const lightG = Math.round(g + (255 - g) * f);
  const lightB = Math.round(b + (255 - b) * f);

  const hexR = lightR.toString(16).padStart(2, '0');
  const hexG = lightG.toString(16).padStart(2, '0');
  const hexB = lightB.toString(16).padStart(2, '0');

  return `#${hexR}${hexG}${hexB}`;
}

/**
 * Computes luminance to return high-contrast text color ('#FFFFFF' or '#000000').
 */
export function getContrastColor(hex: string): string {
  'worklet';
  const clean = hex.replace('#', '').trim();
  let r = 0;
  let g = 0;
  let b = 0;

  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16) || 0;
    g = parseInt(clean[1] + clean[1], 16) || 0;
    b = parseInt(clean[2] + clean[2], 16) || 0;
  } else {
    r = parseInt(clean.substring(0, 2), 16) || 0;
    g = parseInt(clean.substring(2, 4), 16) || 0;
    b = parseInt(clean.substring(4, 6), 16) || 0;
  }

  // Standard perceived luminance calculation
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  return luma > 180 ? '#000000' : '#FFFFFF';
}

/**
 * Returns the 4-stop vertical gradient for the underlying page background.
 * Top: keyColor at full saturation
 * Mid: keyColor transitioning through deep shadow
 * Bottom: #0a0a0a (near-black)
 */
export function getKeyColorGradient(
  keyColor: string,
  bottomDark = '#0a0a0a'
): readonly [string, string, string, string] {
  const midHigh = darkenColor(keyColor, 0.45);
  const midLow = darkenColor(keyColor, 0.75);
  return [keyColor, midHigh, midLow, bottomDark] as const;
}

/**
 * Returns gradient stops for the hero's progressive color overlay.
 * Fades in over the hero image as the user scrolls.
 */
export function getOverlayGradient(
  keyColor: string,
  bottomDark = '#0a0a0a'
): readonly [string, string, string] {
  return [hexToRgba(keyColor, 0.0), hexToRgba(keyColor, 0.5), hexToRgba(bottomDark, 0.95)] as const;
}

/**
 * Returns tint color for the sticky frosted nav bar (keyColor at ~30% opacity).
 */
export function getNavTint(keyColor: string, opacity = 0.3): string {
  return hexToRgba(keyColor, opacity);
}

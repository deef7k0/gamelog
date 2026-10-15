/**
 * The paint pour's geometry — pure, so `npm test` holds it.
 *
 * The owner's correction (2026-10-15): the fill "should be a circle that
 * expands on the pill and stops when the circle reaches everything inside the
 * pill". So the circle's last size is the one that just covers the shape — no
 * bigger, or its final stretch happens out of sight and the pour seems to
 * finish early and then hang.
 */

/**
 * How far the farthest point inside a rounded rectangle is from its centre:
 * the radius at which a circle grown from the centre has covered all of it.
 *
 * A rounded rectangle's farthest points are on its corner arcs, along the line
 * from the centre through each arc's own centre — so that distance plus the
 * corner radius. For a pill (corners of half its height) that is half its
 * width: the tips of its two round ends. For square corners, half the diagonal.
 */
export function paintReach(width: number, height: number, cornerRadius: number): number {
  const corner = Math.max(0, Math.min(cornerRadius, width / 2, height / 2));
  return Math.hypot(width / 2 - corner, height / 2 - corner) + corner;
}

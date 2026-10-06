/**
 * The copy showcase's camera: how a flat view is drawn so that it looks like
 * one upright face of a box that is turned round where it stands.
 *
 * ## Why this is arithmetic and not a transform
 *
 * A case with thickness is several faces — cover, back, spine, opening edge,
 * and, open, a tray and a leaf — in one space, seen by one camera. React Native
 * has no such space. Every view is flattened into its parent before the parent
 * is drawn, so faces cannot share a 3D scene; and on Android a view's transform
 * is not kept as a matrix at all. It is decomposed into what `View` has setters
 * for — rotation, scale, translation in x and y, a camera distance — and the
 * rest is dropped: a translation in z is gone, and a translation after a
 * perspective is applied on the screen rather than in depth. A face moved
 * forward by half the case's thickness, or an edge strip carried out to the
 * side of a turning box, arrives somewhere else on Android than on iOS, and the
 * box comes apart at its corners.
 *
 * So the projection is done here, by hand, and each face is then asked for in
 * the only vocabulary both platforms honour identically:
 *
 *  - an **inner** view turned about its own centre: `perspective`, `rotateY`
 *  - an **outer** view placing it on the screen: `translateX`, `scaleX`, `scaleY`
 *
 * Nested, those compose on the screen, the same way everywhere. `solveFace`
 * finds the five numbers that make that pair land exactly on the face's true
 * projection. It is exact, not close: an upright rectangle projects to a
 * trapezoid with upright sides, a turned view is the same kind of trapezoid,
 * and two projective maps of one rectangle that agree at four corners agree at
 * every point. So when the corners match, the artwork on the face is
 * foreshortened correctly too.
 *
 * ## Conventions
 *
 * The plan view: `x` to the right, `z` toward the viewer, the camera on the
 * `z` axis at `STAGE_CAMERA` dp looking back at the origin, which is the object's
 * centre. Heights do not appear — every face is centred on the camera's height,
 * which is what keeps its two sides upright and the solve this small. Angles
 * are degrees, and a positive turn carries the near face to the **right**, as a
 * finger dragging right across it would: React Native's `rotateY`.
 *
 * Pure, and every function is a worklet: this runs on the UI thread on every
 * frame the case moves. `npm test` checks the solve against the projection it
 * is standing in for.
 */

/** How far the app's one camera stands from every object it draws — the case's own 900. */
export const STAGE_CAMERA = 900;

/**
 * The most an inner view is ever turned.
 *
 * A face seen nearly edge-on would need its view turned nearly edge-on too,
 * where its drawn width goes to nothing and the outer scale that restores it
 * goes to infinity. Past this the view is held here and its *perspective* is
 * tightened instead, which reaches the same trapezoid from a well-conditioned
 * side. Only a face pointing at the camera from off to one side gets here: an
 * open cover.
 */
const MAX_VIEW_TURN = 72;

const RAD = Math.PI / 180;

export type FacePose = {
  /** Whether the face's front is toward the camera. Drawn only when it is. */
  visible: boolean;
  /** The outer view: where on the screen, and how large. */
  tx: number;
  sx: number;
  sy: number;
  /** The inner view: its camera distance and its turn, in degrees. */
  perspective: number;
  angle: number;
};

/** A face that is not drawn: turned away, edge-on, or not there at the moment. */
export const HIDDEN_FACE: FacePose = {
  visible: false,
  tx: 0,
  sx: 1,
  sy: 1,
  perspective: STAGE_CAMERA,
  angle: 0,
};

/**
 * One upright face, from its two upright edges.
 *
 * `(ax, az)` is the edge on the face's own left as its front is read — so the
 * same rectangle given the other way round is its back — and `(bx, bz)` the
 * edge on its right. `width` is the laid-out width of the view that draws it,
 * which is the face's real width only while the object is at full size:
 * `scale` says how much smaller or larger the whole object currently stands,
 * and is what the height has to be told, since heights are not in the plan.
 */
export function solveFace(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  width: number,
  scale = 1
): FacePose {
  'worklet';
  /*
   * Read here, in the body, and never as a parameter's default. On the UI
   * thread a worklet's captured names are unpacked by its first statement, and
   * a parameter's default is evaluated before that: `camera = STAGE_CAMERA`
   * found no such name there and took the whole screen down on its first
   * frame — while passing every test, because under Node a default sees the
   * module like anything else. A default may be a literal, as `scale`'s is.
   */
  const camera = STAGE_CAMERA;
  /* Each edge's magnification, and where it lands on the screen. */
  const ka = camera / (camera - az);
  const kb = camera / (camera - bz);
  const left = ax * ka;
  const right = bx * kb;

  /* The front shows only while its left edge is drawn left of its right one.
     Under a perspective that is not the same as "its normal points at us": an
     edge strip off to one side is seen for a few degrees after it has turned
     its back, and this is what gets that right. */
  if (right - left < 0.5) return HIDDEN_FACE;

  const half = width / 2;
  const depth = az - bz;

  let angle = 0;
  let perspective = camera;
  let reach = 0;
  if (Math.abs(depth) > 0.001) {
    const real = Math.atan2(depth, bx - ax) / RAD;
    angle = Math.max(-MAX_VIEW_TURN, Math.min(MAX_VIEW_TURN, real));
    /* How far the view's near edge comes forward, and the camera distance at
       which that makes its two sides differ in height by what the real face's
       do. Turned by the face's real angle this is simply the distance to the
       face's centre. */
    reach = half * Math.sin(angle * RAD);
    perspective = (reach * (2 * camera - az - bz)) / depth;
  }

  const span = half * Math.cos(angle * RAD);
  const nearK = perspective / (perspective - reach);
  const farK = perspective / (perspective + reach);
  const viewLeft = -span * nearK;
  const viewRight = span * farK;

  const sx = (right - left) / (viewRight - viewLeft);
  return {
    visible: true,
    tx: left - sx * viewLeft,
    sx,
    sy: (scale * ka) / nearK,
    perspective,
    angle,
  };
}

/** A point of the plan turned about the object's centre: its new `x`. */
export function turnX(x: number, z: number, degrees: number): number {
  'worklet';
  return x * Math.cos(degrees * RAD) + z * Math.sin(degrees * RAD);
}

/** A point of the plan turned about the object's centre: its new `z`. */
export function turnZ(x: number, z: number, degrees: number): number {
  'worklet';
  return z * Math.cos(degrees * RAD) - x * Math.sin(degrees * RAD);
}

/** The face-on angle nearest to this one: the cover at 0, the back at 180, and every lap of each. */
export function nearestFace(degrees: number): number {
  'worklet';
  /* `|| 0`: rounding a small negative turn answers -0, which is not 0 to a test. */
  return Math.round(degrees / 180) * 180 || 0;
}

/** The cover-on angle nearest to this one. */
export function nearestFront(degrees: number): number {
  'worklet';
  return Math.round(degrees / 360) * 360 || 0;
}

/** Whether the front is the side toward the camera at this angle. */
export function showsFront(degrees: number): boolean {
  'worklet';
  return Math.cos(degrees * RAD) >= 0;
}

/**
 * Where a turn let go at this speed comes to rest: carried on by its momentum
 * for `COAST` seconds' worth, then squared onto the nearest face.
 */
const COAST = 0.22;

export function restAfter(degrees: number, degreesPerSecond: number): number {
  'worklet';
  return nearestFace(degrees + degreesPerSecond * COAST);
}

/** 0 below `from`, 1 above `to`, and eased between. */
export function smoothstep(from: number, to: number, value: number): number {
  'worklet';
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/**
 * The idle turn, as the easing of one long animation.
 *
 * The drift is a single timing through `halves` half-turns, so that nothing has
 * to restart it face by face; this shapes it. Each half-turn runs slow, quick,
 * slow — lingering on the cover and on the back, hurrying through the edges
 * between them, where there is least to look at — and `linger` is the share of
 * the pace that never eases, which is what keeps it from ever standing still.
 */
export function driftProgress(t: number, halves: number, linger: number): number {
  'worklet';
  const laps = Math.min(Math.max(t, 0), 1) * halves;
  const done = Math.min(Math.floor(laps), halves - 1);
  const within = laps - done;
  const eased = linger * within + (1 - linger) * (0.5 - 0.5 * Math.cos(Math.PI * within));
  return (done + eased) / halves;
}

/** A drag past its limit: one to one at first, then giving less and less, and never past `limit`. */
export function rubberBand(value: number, limit: number): number {
  'worklet';
  return Math.sign(value) * limit * (1 - Math.exp(-Math.abs(value) / limit));
}

/** A face of the object where it currently stands: turned, scaled and moved aside, then solved. */
export function solvePlaced(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  width: number,
  degrees: number,
  scale: number,
  shift: number
): FacePose {
  'worklet';
  return solveFace(
    scale * turnX(ax, az, degrees) + shift,
    scale * turnZ(ax, az, degrees),
    scale * turnX(bx, bz, degrees) + shift,
    scale * turnZ(bx, bz, degrees),
    width,
    scale
  );
}

// ---------------------------------------------------------------------------
// The lamp
// ---------------------------------------------------------------------------

/**
 * Where the stage's one lamp hangs: up and to the left, the side the case's
 * shadow has always fallen away from (DESIGN.md § 4.1.7, offset 6 by 12).
 * Degrees round from straight ahead; negative is the viewer's left.
 */
const LAMP = -24;
/** How far the phone's tilt swings it, either way. */
const LAMP_SWING = 16;

/** An angle brought into -180…180. */
export function wrapDegrees(degrees: number): number {
  'worklet';
  return ((((degrees + 180) % 360) + 360) % 360) - 180;
}

/**
 * How much of the lamp a face has lost by turning from it, 0–1.
 *
 * `facing` is where the face's front points, round from straight ahead. This is
 * what makes a turning box read as a box: its spine is not the cover's
 * brightness, and each darkens as it goes.
 */
export function lampShade(facing: number, tiltX: number): number {
  'worklet';
  const off = wrapDegrees(facing) - (LAMP + LAMP_SWING * tiltX);
  return (1 - Math.cos(off * RAD)) / 2;
}

/**
 * Where the lamp's reflection lies across a face: 0 its left edge, 1 its right,
 * and well outside that when the face is not catching it.
 *
 * At rest it waits just off the left edge. It crosses as the face comes round
 * to square — the glint a cover gives as it turns to you — and the phone moves
 * it too: tilt the display and the light slides over the plastic with nothing
 * else moving.
 */
export function lampGlint(facing: number, tiltX: number, tiltY: number): number {
  'worklet';
  const across = -0.12 + (26 * tiltX + 16 * tiltY - wrapDegrees(facing)) / 30;
  return Math.max(-1.9, Math.min(1.9, across));
}

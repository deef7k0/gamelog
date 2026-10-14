#!/usr/bin/env node
/**
 * The score figures: five drawings of one little man and his gaming chair,
 * which stand for a 0–100 score the way a row of stars would.
 *
 *     0   gone       the chair, empty — he has left
 *    50   asleep     slumped in it, asleep, the controller still in his hand
 *    70   seated     sitting up, playing
 *    80   forward    on the edge of the seat, leaning in, smiling
 *   100   standing   on his feet — and no chair
 *
 * The owner's brief (2026-10-12), after the little man a newspaper rates films
 * with: the same five states for games, the chair a gaming chair, the last one
 * the man alone, and no screen in any of them. These are this app's own
 * drawings of that idea — its man has the quiff the Must Play face has.
 *
 * Their rulings on the drawings since, each of which is a comment where it
 * bites: the chair is a **silhouette** and one shape; he has **fingers**; the
 * man at 80 **leans and is not hunched**; the man on his feet has **no arm in
 * the air**; and the controller is **seen from its side, in his hand** — a
 * short slab over his fist, with no trigger and nothing under it.
 *
 * ## This script is the source
 *
 * The app has no SVG renderer, so what ships is PNG, as the Must Play badge
 * does. Each figure is two layers, each one colour on a transparent ground,
 * and the app tints them (`<ScoreFigure>`):
 *
 *   <key>-tone.png   the chair, what shows of the controller, the z's and
 *                    the sparks — drawn in the score's own colour
 *   <key>-ink.png    the man — drawn in the page's ink
 *
 * The figures are *built*, not traced: every pose is the same parts (a head, a
 * torso, limbs of fixed widths) set at different joints, which is what keeps
 * the man the same man in all five. Change a number here and run:
 *
 *     node scripts/score-figures.mjs
 *
 * It needs `rsvg-convert` (librsvg), as the badge's layers do. It rewrites the
 * PNGs in `assets/images/scores/`, `score-figures.svg` beside them (all five,
 * to look at) and `score-figures.png` (the same on the app's card colour, at
 * the sizes the app draws them).
 *
 * ## How one colour sits in front of another
 *
 * Nothing overlaps. Each part is cut away under everything in front of it,
 * and under a halo round that (`GAP`) — so the arm crossing the body has a
 * line of nothing round it, and that line is whatever the figure is standing
 * on. The same cut is what makes a face: the eye and the mouth are holes in
 * the head. So two flat layers, drawn in either order, are the whole picture,
 * and it sits on any surface.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The square every figure is drawn in. */
const BOX = 128;
/** The clear space round anything that stands in front of something else. */
const GAP = 2.4;
/** How much larger than drawn a figure is set, and where its feet stand. */
const SCALE = 1.08;
const FLOOR = 124.5;
/** The side of a shipped PNG, in px: 96dp at 3×, the largest the app draws one. */
const PIXELS = 288;

// ---------------------------------------------------------------- primitives

const line = (points, w) => ({
  kind: 'stroke',
  d: 'M' + points.map((p) => p.join(' ')).join(' L'),
  w,
});
const curve = (d, w) => ({ kind: 'stroke', d, w });
const shape = (d) => ({ kind: 'fill', d });
const dot = (cx, cy, r) => ({ kind: 'circle', cx, cy, r });

const round = (v) => Math.round(v * 100) / 100;

/** One primitive in one colour; `grow` fattens it, which is how a halo is cut. */
function draw(prim, colour, grow = 0) {
  const t = prim.t ? ` transform="${prim.t}"` : '';
  if (prim.kind === 'stroke') {
    return `<path d="${prim.d}"${t} fill="none" stroke="${colour}" stroke-width="${round(prim.w + grow * 2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  if (prim.kind === 'circle') {
    return `<circle cx="${round(prim.cx)}" cy="${round(prim.cy)}" r="${round(prim.r + grow)}"${t} fill="${colour}"/>`;
  }
  const edge =
    grow > 0 ? ` stroke="${colour}" stroke-width="${round(grow * 2)}" stroke-linejoin="round"` : '';
  return `<path d="${prim.d}"${t} fill="${colour}"${edge}/>`;
}

function turned([x, y], degrees) {
  const a = (degrees * Math.PI) / 180;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
}

/** A point `offset` from `centre`, in a frame tilted by `degrees`. */
function at([cx, cy], offset, degrees = 0) {
  const [x, y] = turned(offset, degrees);
  return [round(cx + x), round(cy + y)];
}

// ----------------------------------------------------------------- the chair

/**
 * The gaming chair, in profile, facing right — **as a silhouette, and one
 * shape**: the racing seat's tall back with its wing at the shoulder, the
 * cushion, and the stem down to a star base on casters.
 *
 * The owner's ruling on the first drawing, which showed its cushions, its
 * piping, its hinge and its armrest each as a part: "all I want is the
 * silhouette of the gaming chair, not every component visible". So nothing is
 * cut into it and nothing is set apart from it. Do not add detail back.
 */
function chair() {
  return [
    {
      colour: 'tone',
      prims: [
        // the back: raked, rounded at the top, its wing forward at the shoulder
        shape(
          'M29.5 102 C27 82 23 58 21.6 36 C21 26 21.6 16 26.8 14.6 C30.6 13.8 34 15.8 34.6 19.6 L35.4 31.4 ' +
            'C35.6 34 35 36 34.2 37.6 C39.6 38.4 45.4 42.2 46.6 47.4 C47.4 50.6 45.6 53 42.6 53.6 ' +
            'C39.8 57 38 61 37.4 65.4 C39.6 70 41.6 76 41.8 83 L42 102 Z'
        ),
        // the cushion, its front edge rolled up
        line(
          [
            [36, 99.6],
            [73, 99],
          ],
          11
        ),
        dot(75.4, 98, 6.2),
        // the stem
        line(
          [
            [56, 104],
            [56, 113],
          ],
          6.4
        ),
        // the star base, and a caster at each end of it
        line(
          [
            [56, 113],
            [37.6, 116.6],
          ],
          4.8
        ),
        line(
          [
            [56, 113],
            [74.4, 116.6],
          ],
          4.8
        ),
        dot(36.8, 118.6, 3.6),
        dot(56, 118.8, 3.6),
        dot(75.2, 118.6, 3.6),
      ],
    },
  ];
}

// ------------------------------------------------------------------- the man

const HEAD = 13.5;
const TORSO = 18;
const LEG = 11;
const ARM = 8.6;
const SHOE = 9.6;

/**
 * The head, in profile, looking right: the ball, a nose, the quiff swept up
 * off the forehead — and the face, which is cut out of it.
 */
function head(centre, tilt, face) {
  const P = (offset) => at(centre, offset, tilt).join(' ');
  const prims = [
    dot(centre[0], centre[1], HEAD),
    dot(...at(centre, [HEAD - 0.2, 2], tilt), 3.4),
    shape(
      `M${P([-9, -9.6])} C${P([-7, -17])} ${P([2, -21])} ${P([9.6, -17.4])} C${P([11.6, -16.4])} ${P([11.4, -13.8])} ${P([9.2, -13.6])} C${P([6.4, -13.4])} ${P([5.8, -11.4])} ${P([7, -9.6])} Z`
    ),
  ];

  const knock = [];
  const arc = (points, w) => {
    const [a, m, b] = points.map((p) => at(centre, p, tilt));
    knock.push(curve(`M${a.join(' ')} Q${m.join(' ')} ${b.join(' ')}`, w));
  };

  const eye = at(centre, [6.2, -2.4], tilt);
  if (face.eye === 'open') knock.push(dot(eye[0], eye[1], 2));
  if (face.eye === 'wide') knock.push(dot(eye[0], eye[1], 2.4));
  if (face.eye === 'shut')
    arc(
      [
        [3.6, -2.4],
        [6.4, 0.2],
        [9.2, -2.4],
      ],
      1.7
    );

  if (face.mouth === 'flat')
    arc(
      [
        [5.2, 6.4],
        [7.8, 6.8],
        [10.4, 6.2],
      ],
      1.7
    );
  if (face.mouth === 'smile')
    arc(
      [
        [4, 4.8],
        [7.4, 9.8],
        [11, 5],
      ],
      1.9
    );
  if (face.mouth === 'grin')
    knock.push(shape(`M${P([3, 4])} Q${P([7.2, 13.6])} ${P([11.4, 4])} Z`));
  if (face.mouth === 'snore') knock.push(dot(...at(centre, [8, 7], tilt), 2.1));

  // the ear
  arc(
    [
      [-2.6, -1.2],
      [-6, 1.4],
      [-2.4, 3.2],
    ],
    1.3
  );
  return { prims, knock };
}

/** The line where a trouser leg ends and a shoe begins. */
function cuff({ knee, ankle }) {
  const length = Math.hypot(ankle[0] - knee[0], ankle[1] - knee[1]);
  const along = [(ankle[0] - knee[0]) / length, (ankle[1] - knee[1]) / length];
  const across = [-along[1], along[0]];
  const middle = [ankle[0] - along[0] * 4.6, ankle[1] - along[1] * 4.6];
  const reach = LEG / 2 + 1;
  return line(
    [
      [round(middle[0] - across[0] * reach), round(middle[1] - across[1] * reach)],
      [round(middle[0] + across[0] * reach), round(middle[1] + across[1] * reach)],
    ],
    1.5
  );
}

function leg(hip, joints) {
  return {
    prims: [line([hip, joints.knee, joints.ankle], LEG), line([joints.ankle, joints.toe], SHOE)],
    knock: [cuff(joints)],
  };
}

/** Everything of him but his arm: head, torso, and the leg nearer the reader. */
function body({ hip, shoulder, headAt, tilt, face, near }) {
  const top = head(headAt, tilt, face);
  const limb = leg(hip, near);
  return {
    colour: 'ink',
    prims: [line([hip, shoulder], TORSO), ...top.prims, ...limb.prims],
    knock: [...top.knock, ...limb.knock],
  };
}

// ------------------------------------------------------ the controller, held

/** How much larger than life his hand and what is in it are drawn. */
const GRIP = 1.12;
/** The clear space round his fingers: finer than `GAP`, because they are. */
const FINGER_GAP = 0.95;

/**
 * The controller, **seen from its side**, and the hand that holds it.
 *
 * The owner's direction: "make the man *hold* the controller. Have it face the
 * little man, so for the user the controller is viewed from the side, and we
 * would only be able to see the little man's hand and fingers wrapping around
 * the side of the controller… It's all about perspective." He is in profile,
 * so it is too: edge on, its face toward his own.
 *
 * So the hand is in front and most of the controller is behind it. What shows
 * of the controller is **a short slab standing just proud of his fist** — the
 * edge of its body — and nothing else. The first drawing of this had more, and
 * the owner called it scuffed and took three things off it:
 *
 *  - **no trigger**, and so no finger reaching for one: "the index finger is
 *    super long". His three fingers are the same length, wrapped;
 *  - **nothing under his fist**: the tip of the grip poked out "below, on the
 *    pinky finger". The grip is inside his hand and is not drawn;
 *  - **short**: "the controller is also super long". It clears his fingertips
 *    by a couple of units and stops.
 *
 * A stick standing on its top was tried before that and made it a bottle with
 * a stopper. Do not add a part back to it.
 *
 * Drawn about its own origin — the middle of his fist — and placed by `where`
 * and `tilt`; +x is away from him.
 *
 * @returns the controller, his hand, and where his wrist is
 */
function held(where, tilt) {
  const t = `translate(${where[0]} ${where[1]}) rotate(${tilt}) scale(${GRIP})`;
  const placed = (prims) => prims.map((prim) => ({ ...prim, t }));

  const controller = {
    colour: 'tone',
    reach: [where[0], where[1], 13 * GRIP],
    // the body, edge on: over his fingers, and a little past them. It starts
    // behind his thumb — a sliver of it showing on the near side of the thumb
    // was a scrap, not a controller
    prims: placed([
      line(
        [
          [0.2, -4.4],
          [6.8, -4.9],
        ],
        6.4
      ),
    ]),
  };

  const hand = placed([
    // the back of the hand, where the forearm arrives
    dot(-4.4, 3.4, 4.5),
    // the thumb, up and over the near end of the body
    curve('M-3.7 0.2 Q-3.6 -6 0.6 -8.3', 3),
    // three fingers, wrapped round it
    line(
      [
        [-1.4, 0.7],
        [4.9, 1.2],
      ],
      2.6
    ),
    line(
      [
        [-1.8, 4],
        [4.6, 4.5],
      ],
      2.6
    ),
    line(
      [
        [-2.4, 7.3],
        [3.6, 7.8],
      ],
      2.6
    ),
  ]).map((prim) => ({ ...prim, halo: FINGER_GAP }));

  return { controller, hand, wrist: at(where, [-6 * GRIP, 4 * GRIP], tilt) };
}

/** His arm, to a hand that is holding the controller: all one limb. */
function holding({ shoulder, elbow, where, tilt }) {
  const { controller, hand, wrist } = held(where, tilt);
  return [
    controller,
    {
      colour: 'ink',
      reach: controller.reach,
      prims: [line([shoulder, elbow, wrist], ARM), ...hand],
    },
  ];
}

// ----------------------------------------------------------------- the poses

/** Each figure, as its parts from the back of the picture to the front. */
const FIGURES = {
  /** 0 — he has gone. */
  gone: () => chair(),

  /** 50 — asleep in the chair, head back, the controller still in his hand. */
  asleep: () => [
    ...chair(),
    body({
      hip: [57, 88],
      shoulder: [43.5, 66],
      headAt: [40.5, 52],
      tilt: -22,
      face: { eye: 'shut', mouth: 'snore' },
      near: { knee: [80, 90], ankle: [98, 112], toe: [106.5, 107.5] },
    }),
    ...holding({ shoulder: [45.5, 68.5], elbow: [50.5, 82.5], where: [69, 78.6], tilt: 14 }),
    {
      colour: 'tone',
      prims: [curve('M61 37 H68 L61 45 H68', 2.6), curve('M73 22 H78.6 L73 28.4 H78.6', 2.2)],
      reach: [70, 34, 12],
    },
  ],

  /** 70 — sitting up, playing. */
  seated: () => [
    ...chair(),
    body({
      hip: [50, 88],
      shoulder: [48.5, 63],
      headAt: [51.5, 49.5],
      tilt: 0,
      face: { eye: 'open', mouth: 'flat' },
      near: { knee: [74, 87.5], ankle: [76, 115.5], toe: [87, 117.2] },
    }),
    ...holding({ shoulder: [49.5, 65], elbow: [55, 80], where: [72, 73.6], tilt: -12 }),
  ],

  /**
   * 80 — on the edge of the seat, clear of its back, leaning in.
   *
   * A straight back at a lean, and it stays one: for one build the owner
   * asked for "a visible and exaggerated hunchback", saw it — an arch with a
   * hump standing above his own head — and said "too much. Go back to the old
   * one, that was fine." Do not hunch him again.
   */
  forward: () => [
    ...chair(),
    body({
      hip: [59, 88],
      shoulder: [76, 64],
      headAt: [85, 51.5],
      tilt: 8,
      face: { eye: 'wide', mouth: 'smile' },
      near: { knee: [84, 88], ankle: [80, 115.5], toe: [91, 117.2] },
    }),
    ...holding({ shoulder: [76.5, 66], elbow: [87, 81], where: [103, 75.4], tilt: -12 }),
  ],

  /**
   * 100 — on his feet. No chair, and nothing but him: the arm he had in the
   * air read as "a little pillow on the back of his head", and is gone.
   */
  standing: () => {
    const hip = [62, 70];
    const far = leg(hip, { knee: [55, 93], ankle: [50, 115.5], toe: [60.5, 117.2] });
    return [
      { colour: 'ink', ...far },
      body({
        hip,
        shoulder: [60.5, 44],
        headAt: [63.5, 30.5],
        tilt: -6,
        face: { eye: 'wide', mouth: 'grin' },
        near: { knee: [69, 93], ankle: [72, 115.5], toe: [83, 117.2] },
      }),
      ...holding({ shoulder: [61.5, 46], elbow: [68, 61], where: [83.6, 55], tilt: -16 }),
      // sparks, off the top of his head
      {
        colour: 'tone',
        prims: [
          line(
            [
              [76.9, 15.6],
              [80.6, 11.6],
            ],
            2.6
          ),
          line(
            [
              [83, 22.6],
              [89.5, 20],
            ],
            2.6
          ),
          line(
            [
              [85.6, 32.6],
              [91.6, 33.2],
            ],
            2.6
          ),
        ],
      },
    ];
  },
};

// -------------------------------------------------------------------- render

/** Where a figure's parts reach, so it can be centred and stood on the floor. */
function bounds(parts) {
  const box = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  const take = (x, y, r) => {
    box.x0 = Math.min(box.x0, x - r);
    box.x1 = Math.max(box.x1, x + r);
    box.y0 = Math.min(box.y0, y - r);
    box.y1 = Math.max(box.y1, y + r);
  };
  for (const part of parts) {
    if (part.reach) take(...part.reach);
    for (const prim of part.prims) {
      // Placed by a transform: `reach` has already spoken for these.
      if (prim.t) continue;
      if (prim.kind === 'circle') take(prim.cx, prim.cy, prim.r);
      else if (!/[HV]/.test(prim.d)) {
        const numbers = prim.d.match(/-?\d+(\.\d+)?/g).map(Number);
        const half = prim.kind === 'stroke' ? prim.w / 2 : 0;
        for (let i = 0; i + 1 < numbers.length; i += 2) take(numbers[i], numbers[i + 1], half);
      }
    }
  }
  return box;
}

/**
 * One figure as SVG, inside a `BOX` square. `colours` gives each layer its
 * colour, or null to leave the layer out — it still cuts what is behind it,
 * which is how one layer is exported without the other.
 */
function figure(key, colours, prefix = key) {
  const parts = FIGURES[key]();
  const masks = [];
  const drawn = [];

  parts.forEach((part, index) => {
    const colour = colours[part.colour];
    if (!colour) return;

    const cuts = [
      ...parts
        .slice(index + 1)
        .flatMap((front) => front.prims.map((prim) => draw(prim, '#000', prim.halo ?? GAP))),
      ...(part.knock ?? []).map((prim) => draw(prim, '#000')),
    ];
    const id = `${prefix}-${index}`;
    if (cuts.length > 0) {
      masks.push(
        `<mask id="${id}" maskUnits="userSpaceOnUse" x="-64" y="-64" width="256" height="256"><rect x="-64" y="-64" width="256" height="256" fill="#fff"/>${cuts.join('')}</mask>`
      );
    }
    const mask = cuts.length > 0 ? ` mask="url(#${id})"` : '';
    drawn.push(`<g${mask}>${part.prims.map((prim) => draw(prim, colour)).join('')}</g>`);
  });

  const box = bounds(parts);
  const tx = BOX / 2 - ((box.x0 + box.x1) / 2) * SCALE;
  const ty = FLOOR - box.y1 * SCALE;

  /* A figure that leaves its square is a figure with its head cut off. */
  const edges = [box.x0 * SCALE + tx, BOX - (box.x1 * SCALE + tx), box.y0 * SCALE + ty];
  if (Math.min(...edges) < 1.5) {
    throw new Error(`${key} does not fit its square: ${edges.map(round).join(', ')} to spare`);
  }

  return `<g transform="translate(${round(tx)} ${round(ty)}) scale(${SCALE})"><defs>${masks.join('')}</defs>${drawn.join('')}</g>`;
}

const svg = (width, height, inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${inner}</svg>\n`;

const placed = (x, y, size, inner) =>
  `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 ${BOX} ${BOX}">${inner}</svg>`;

// -------------------------------------------------------------------- export

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'assets/images/scores');
const work = mkdtempSync(join(tmpdir(), 'score-figures-'));
mkdirSync(out, { recursive: true });

function rasterise(name, source, width) {
  const file = join(work, `${name}.svg`);
  writeFileSync(file, source);
  execFileSync('rsvg-convert', ['-w', String(width), file, '-o', join(out, `${name}.png`)]);
}

const keys = Object.keys(FIGURES);

// The layers the app ships. An empty chair has no man, so it has no ink.
for (const key of keys) {
  const layers = new Set(FIGURES[key]().map((part) => part.colour));
  for (const layer of ['tone', 'ink']) {
    if (!layers.has(layer)) continue;
    const colours = { tone: null, ink: null, [layer]: '#000' };
    rasterise(`${key}-${layer}`, svg(BOX, BOX, figure(key, colours)), PIXELS);
  }
}

// All five in a row, to look at: the tone in a mid grey, the man in black.
writeFileSync(
  join(out, 'score-figures.svg'),
  svg(
    BOX * keys.length,
    BOX,
    keys
      .map((key, i) => placed(i * BOX, 0, BOX, figure(key, { tone: '#8a8f98', ink: '#16181d' })))
      .join('')
  )
);

// The same on the app's card colour, in the score ramp, at the sizes the app
// draws them: large, then 76dp (a review's page) and 56dp (the ratings graph)
// as a phone at 3× shows them.
const RAMP = { low: '#F35555', mid: '#F5A524', high: '#4ADE80' };
const SHOWN = [
  { key: 'gone', score: 0, tone: RAMP.low },
  { key: 'asleep', score: 50, tone: RAMP.mid },
  { key: 'seated', score: 70, tone: RAMP.high },
  { key: 'forward', score: 80, tone: RAMP.high },
  { key: 'standing', score: 100, tone: RAMP.high },
];
const LARGE = 256;
const SMALL = [228, 168];
const MARGIN = 20;
const sheetWidth = MARGIN + SHOWN.length * (LARGE + MARGIN);
const sheetHeight = MARGIN + LARGE + SMALL.reduce((sum, size) => sum + size + MARGIN, MARGIN);

let sheet = `<rect width="${sheetWidth}" height="${sheetHeight}" fill="#14171c"/>`;
SHOWN.forEach(({ key, tone }, column) => {
  const x = MARGIN + column * (LARGE + MARGIN);
  const colours = { tone, ink: '#F5F5F5' };
  sheet += `<rect x="${x}" y="${MARGIN}" width="${LARGE}" height="${LARGE}" rx="14" fill="#111419"/>`;
  sheet += placed(x, MARGIN, LARGE, figure(key, colours, `l-${key}`));
  let y = MARGIN + LARGE + MARGIN;
  for (const size of SMALL) {
    sheet += placed(x + (LARGE - size) / 2, y, size, figure(key, colours, `s${size}-${key}`));
    y += size + MARGIN;
  }
});
rasterise('score-figures', svg(sheetWidth, sheetHeight, sheet), sheetWidth);

console.log(`Wrote the score figures to ${out}`);

// A close look at one figure, while it is being drawn: `CLOSE=forward node …`.
if (process.env.CLOSE) {
  const key = process.env.CLOSE;
  const file = join(work, 'close.svg');
  writeFileSync(
    file,
    `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="${process.env.CROP ?? `0 0 ${BOX} ${BOX}`}"><rect x="-64" y="-64" width="256" height="256" fill="#111419"/>${figure(key, { tone: '#4ADE80', ink: '#F5F5F5' })}</svg>`
  );
  execFileSync('rsvg-convert', [
    '-w',
    '720',
    file,
    '-o',
    join(tmpdir(), `score-figure-${key}.png`),
  ]);
}

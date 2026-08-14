/**
 * Design tokens.
 *
 * Dark only, and never true black. The page is #121212 and depth is built from
 * *surface steps* — background → surface → surfaceElevated → surfaceSelected —
 * rather than from shadows, which are close to invisible on a dark screen
 * anyway. A card looks lifted because it is lighter than what is behind it.
 *
 * **The room is dark; the light comes from the games in it.**
 *
 * The chrome is still greyscale — surfaces, rules, body copy and every control
 * that is not the primary one. What changed is that colour is no longer a single
 * house accent applied to chrome. It enters from *content*, in three ways, and
 * a colour that is none of these three is decoration and does not belong:
 *
 *  1. **Identity** — the ten-hue ramp below. A game takes one, derived from its
 *     own IGDB genres (`constants/identity.ts`), and that hue lights its page:
 *     the cast under its case, its active tab, its primary action, its links.
 *     Two games are never the same page in two skins.
 *  2. **Meaning** — score, log status, achievement rarity, tier. These are
 *     *data*: a reader parses good/bad, playing/dropped, common/legendary before
 *     they parse the digits or the word. They are aliases onto the same ramp, so
 *     the app has one set of hues rather than four unrelated ones.
 *  3. **Artwork** — the cover itself, blurred into an ambient wash behind a
 *     page (`components/ui/ambience.tsx`). Not a derived colour at all: the
 *     actual pixels of the actual box art.
 *
 * `primary` remains PlayStation blue and remains the *house* colour — every
 * screen that is not about one specific game still runs on it, which is what
 * keeps the app from becoming a fruit salad. Identity shifts the accent only
 * where there is a game to shift it to.
 *
 * Everything is a token. Colours, spacing, radii, type, motion and the minimum
 * tap target all live here, and a value typed directly into a component is a
 * bug rather than a shortcut.
 *
 * Read colours through `useTheme()` rather than importing `Colors` directly.
 */

import '@/global.css';

import { Platform } from 'react-native';

import { ensureContrast, readableInk, tint, withAlpha } from '@/lib/color';

export { ensureContrast, readableInk, tint, withAlpha } from '@/lib/color';

export const Colors = {
  /*
   * Dark only.
   *
   * `light` exists so the `ThemeColor` type stays honest and so nothing has to
   * branch, but it holds the same values: this app is a dark room by design and
   * a light counterpart would be a second product. `APP_SCHEME` in
   * `hooks/use-theme` is the single place that says so.
   */
  dark: {
    text: '#F5F5F5',
    textSecondary: '#A8A8A8',
    /**
     * The quiet step — timestamps, counts, captions.
     *
     * Was #767676, which measured 4.12:1 on the page and so failed AA on the
     * two steps that use it most, both of which render at 10px. #808080 is
     * 4.74:1 and is the smallest change that clears the line; going quieter
     * again is not a style choice available here.
     */
    textMuted: '#808080',

    /** The page. Never true black: #000 on OLED smears on scroll and kills the
     *  sense of depth the surface steps are built on. */
    background: '#121212',
    /** Cards and the tab bar. One perceptible step off the page. */
    surface: '#1C1C1C',
    /** Nested surfaces — a block inside a card, a chip, a thumbnail well. */
    surfaceElevated: '#242424',
    /** Selected / pressed surface, and the chip fill. */
    surfaceSelected: '#2A2A2A',
    /** Text fields and the search bar: darker than a card, so an input reads as
     *  a recess rather than as another card. */
    input: '#202020',

    /** Overlays for touch feedback. Layered *over* a surface, never instead. */
    hover: 'rgba(255, 255, 255, 0.04)',
    pressed: 'rgba(255, 255, 255, 0.07)',

    /** Dividers. Barely there on purpose — separation is the surface step's job. */
    border: 'rgba(255, 255, 255, 0.05)',
    borderStrong: 'rgba(255, 255, 255, 0.12)',

    /**
     * The house accent. PlayStation blue, and still the app's own colour:
     * the tab bar, the home feed, search, notifications and every screen that
     * is not about one particular game.
     *
     * **Fills only.** At 3.74:1 on the page it is below AA for text — fine
     * under white (5.0:1 the other way), wrong for a link. Type that wants to
     * look like the house colour uses `primaryText`.
     */
    primary: '#0070CC',
    onPrimary: '#FFFFFF',
    /**
     * The same blue, lifted to 5.76:1 so it can carry a label.
     *
     * Not a second accent — a legibility variant of the first. Anywhere the
     * blue is *type* (a link, an active tab label, "See all") reaches for this;
     * anywhere it is a *fill* keeps `primary`.
     */
    primaryText: '#2E93E8',
    /** A wash of the accent, for the fill behind an active chip or badge. */
    primaryMuted: 'rgba(0, 112, 204, 0.16)',
    accent: '#0070CC',

    /*
     * ---------------------------------------------------------------------
     * The identity ramp — ten hues, and the app's only colour primitives.
     * ---------------------------------------------------------------------
     *
     * Every coloured thing in the app that is not the house blue or the raw
     * artwork resolves to one of these ten. A game's page takes one (from its
     * genres); score, status and rarity alias onto them. That is what makes
     * this a system rather than a bag of swatches: there are ten hues, not
     * thirty-one, and a new meaning gets an alias rather than a new hex.
     *
     * Tuned as a set against #121212, not picked individually:
     *
     *  - Every one clears **4.5:1 on all three surface steps**, so any of them
     *    can carry small type. The floor of the set is `crimson` at 5.78:1 on
     *    `surfaceElevated`; there is no member that only works on the page.
     *  - Every one takes **dark ink** when used as a fill (`readableInk`), which
     *    is why an identity-coloured button is near-black-on-hue rather than
     *    white-on-hue. That is deliberate: white on a mid-chroma hue is the one
     *    combination in this palette that reliably fails.
     *  - Spread around the wheel with gaps wide enough to survive a scrolling
     *    wall of covers. Adjacent games should not read as the same game.
     */
    identityEmber: '#FF9142',
    identityCrimson: '#FF6F7D',
    identityGold: '#F3C24B',
    identityLime: '#A8DC5A',
    identityJade: '#43D98C',
    identityAqua: '#3CD6CE',
    identitySky: '#57B2FF',
    /* Pulled off #8B9DFF, which sat 49 RGB units from `identityViolet` — close
       enough that a strategy game and a puzzle game were the same colour in a
       franchise rail, which is the one place the ramp has to work hardest. */
    identityCobalt: '#8394FF',
    identityViolet: '#B98CFF',
    identityMagenta: '#FF7ACB',

    /*
     * The score ramp. Three colours that are *data*, not chrome.
     *
     * A 0-100 score has to be readable as good/mixed/bad before the digits are,
     * and one hue cannot say that. They appear on numerals and their labels —
     * never on a fill, an outline or a control.
     *
     * **These are now the only score colours.** `scoreColor()` used to return
     * `success`/`accent`/`danger` while `<ScoreBadge>` reached for these three,
     * so the same 55 was amber in one component and blue in another. The blue
     * was the wrong of the two: neutral is *mixed*, and rendering it in the
     * house accent made a middling game look endorsed. Amber, everywhere.
     */
    scoreHigh: '#4ADE80',
    scoreMid: '#F5A524',
    /* Lifted from #EF4444, which measured 4.13:1 on `surfaceElevated` — under
       AA for the 13px inline numeral that a feed row renders it at. #F35555 is
       4.61:1 on the same surface and is the smallest step that clears it. */
    scoreLow: '#F35555',

    /*
     * Log status. Four states, four hues, aliased onto the ramp.
     *
     * `backlog` used to be `textSecondary` — grey, which said "no status" for
     * the one status a logging app is most about. A shelf of things you mean to
     * play is not an absence.
     */
    statusPlaying: '#43D98C',
    statusPlayed: '#2E93E8',
    /**
     * Pale violet: queued, not dead.
     *
     * Lighter than it wants to be, on purpose. The first choice was a dusty
     * #9B93E8, which sits 16 RGB units from `statusPlayed` under simulated
     * protanopia — blue and violet are the classic red-blind collapse, and
     * these two are the pair a backlog screen shows side by side. Lifting the
     * lightness restores the separation to 53, because luminance is the
     * difference that survives when hue does not.
     */
    statusBacklog: '#C9A6FF',
    /** Rust, not the alarm red. Dropping a game is a verdict, not an error. */
    statusDropped: '#CE7B62',

    /*
     * Achievement rarity, from Steam's global unlock percentage.
     *
     * The five-step loot ramp every player already knows how to read — and the
     * one place in this app where borrowing a genre convention beats inventing
     * a vocabulary. Bands live in `constants/rarity.ts`; only the hues are here.
     */
    rarityCommon: '#9AA3AE',
    rarityUncommon: '#43D98C',
    rarityRare: '#57B2FF',
    rarityEpic: '#B98CFF',
    rarityLegendary: '#F3C24B',

    /** Platinum trophies. */
    platinum: '#A9B6CC',

    /* Same lift as `scoreLow`, and for the same reason: `<Button variant="danger">`
       renders this as its label on `surfaceElevated`, where #EF4444 was 4.13:1. */
    danger: '#F35555',
    success: '#4ADE80',

    /*
     * The ambient glow in Home's top-left corner. See `ui/soft-glow.tsx`.
     *
     * Deep muted purple, and the two darkest chromatic values in the palette by
     * a wide margin — `glowCore` is 0.026 relative luminance against the page's
     * 0.0055. That is the whole point: this sits *behind* the masthead, so it
     * has to read as light in the room rather than as a surface. Anything with
     * the chroma of the identity ramp would compete with the title on top of it.
     *
     * Not part of the identity system and not available to it. This is the one
     * decorative colour in the app, it appears in exactly one place, and it is
     * fixed rather than derived precisely so Home does not shift hue with
     * whatever game happens to be on it.
     */
    glowCore: '#3A2050',
    glowEdge: '#2D1B3D',

    /** Scrim over hero artwork so text stays legible on any cover. */
    scrim: 'rgba(0, 0, 0, 0.6)',
    /** Skeleton placeholder fill. */
    skeleton: '#242424',

    /**
     * Ink for gradient ramps over artwork, and the palette's only true black.
     *
     * Not a surface: `background` is still the floor and nothing is ever *filled*
     * with this. It exists because a fade sitting under a photograph has to
     * reach real black, which `scrim` (a flat 60% overlay) cannot do. Always
     * fade it with `withAlpha(shadowInk, 0)`, never the keyword `transparent`.
     */
    shadowInk: '#000000',

    /*
     * The tier-list ramp. Data rather than chrome, and exempt from the
     * one-accent rule for the same reason the score ramp is: a tier list is a
     * chart of the user's own judgement, and six rows that are all grey is not a
     * tier list. Warm → cool so the ordering reads before the letters do.
     *
     * Row-header fills only. These are tuned as backgrounds for near-black type
     * and are not legible as text colours on a dark surface.
     */
    tierS: '#FF7B7B',
    tierA: '#FFB068',
    tierB: '#FFD86B',
    tierC: '#B6E07A',
    tierD: '#7ACBE0',
    tierF: '#B0A6E0',

    /** Legacy aliases kept so older call sites keep compiling. */
    backgroundElement: '#202020',
    backgroundSelected: '#2A2A2A',
  },
} as const;

/** Dark-only: the light palette is the dark one. See the note above. */
export const Palette = Colors.dark;

export type ThemeColor = keyof typeof Colors.dark;
export type ThemePalette = typeof Colors.dark;

/**
 * The identity ramp in order, as palette keys.
 *
 * `constants/identity.ts` maps genres onto these names rather than onto hexes,
 * so retuning a hue is a one-line edit here and nothing downstream knows.
 */
export const IDENTITY_KEYS = [
  'identityEmber',
  'identityCrimson',
  'identityGold',
  'identityLime',
  'identityJade',
  'identityAqua',
  'identitySky',
  'identityCobalt',
  'identityViolet',
  'identityMagenta',
] as const satisfies readonly ThemeColor[];

export type IdentityKey = (typeof IDENTITY_KEYS)[number];

/**
 * How much hue goes into a tinted surface.
 *
 * High, and it can afford to be: `tint` restores the surface's original
 * luminance afterwards, so this dial changes only *chroma*. At 0.3 `surface`
 * under the sky hue resolves to #101D29 — unmistakably blue, unmistakably still
 * a near-black card. Below about 0.15 the tint stops being legible as a colour
 * and starts looking like a rendering artefact.
 */
const SURFACE_TINT = 0.3;

/**
 * Everything one accent hue has to be able to do, derived from the hue itself.
 *
 * A hue arrives as a single hex — from a game's genres, or `primary` when there
 * is no game — and a page needs six things from it. Deriving them beats storing
 * them: ten hues × six roles would be sixty tokens to keep in step, and the
 * whole point of the ramp is that adding an eleventh hue costs one line.
 *
 * **A tinted surface measures the same as the grey it replaces.** `tint` mixes
 * the hue in and then puts the luminance back, so contrast against every text
 * token moves by at most 0.07 — pure 8-bit rounding — across all ten hues on
 * both steps, and no AA or AAA verdict flips anywhere. That is the property
 * that makes these safe to use wherever the grey was: no per-hue exceptions and
 * no "careful what you put on the red one". (`textMuted` sits at 3.9:1 on the
 * elevated step, tinted or not — a pre-existing limit of the quiet grey on the
 * lightest surface, unchanged by any of this.)
 */
export type AccentRoles = {
  /** The hue as a **fill**: a primary button, a filled badge, a tier row. */
  color: string;
  /**
   * The hue as **type on the page**: a link, an active tab label, a glyph, an
   * underline.
   *
   * Usually identical to `color` — every hue in the identity ramp already
   * clears 4.5:1 on all three surface steps. It differs for exactly one accent,
   * and that one matters: the house blue `#0070CC` is 3.74:1 on the page, which
   * is fine under white on a filled button and below AA the moment it becomes a
   * word. This is the same split `primary` / `primaryText` makes, computed for
   * whatever hue is in force rather than hard-coded for one.
   */
  onSurface: string;
  /** Near-black or white — whichever is legible *on* `color`. */
  ink: string;
  /** 14% fill behind an active chip, pill or badge. */
  wash: string;
  /** The page surface, carrying the hue at the same lightness. */
  surface: string;
  /** One step up, for a block sitting on `surface`. */
  elevated: string;
  /** The coloured light an object casts. Alpha, so it works over artwork. */
  glow: string;
};

export function accentRoles(hue: string): AccentRoles {
  return {
    color: hue,
    /* Measured against `surfaceElevated`, not the page. It is the lightest
       thing accented type ever lands on, so clearing AA there clears it
       everywhere; targeting the page instead leaves a link inside a card at
       3.98:1, which is the exact case this role exists to prevent. */
    onSurface: ensureContrast(hue, Colors.dark.surfaceElevated, 4.5),
    ink: readableInk(hue),
    wash: withAlpha(hue, 0.14),
    surface: tint(Colors.dark.surface, hue, SURFACE_TINT),
    elevated: tint(Colors.dark.surfaceElevated, hue, SURFACE_TINT),
    glow: withAlpha(hue, 0.42),
  };
}

/**
 * Inter, in four weights, and nothing else.
 *
 * **Weight is a family here, not a `fontWeight`.** React Native on Android will
 * not synthesise a bold from a custom font: `fontFamily: 'Inter_400Regular'`
 * plus `fontWeight: '700'` renders regular, silently, and the bug only shows on
 * one platform. Every weight is therefore a separate loaded family, and nothing
 * in the app should set `fontWeight` on text again — reach for one of these.
 *
 * Four weights because the system uses three: 400 for reading, 500 for small
 * dense metadata, 600 for anything that has to be picked out of a page. 700 is
 * reserved for the two largest steps, which are page titles.
 */
export const FontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: FontFamily.regular,
    serif: 'ui-serif',
    rounded: FontFamily.regular,
    mono: 'ui-monospace',
  },
  default: {
    sans: FontFamily.regular,
    serif: 'serif',
    rounded: FontFamily.regular,
    mono: 'monospace',
  },
});

/**
 * The 8-point scale, named for the value.
 *
 * `Spacing.x16` is sixteen pixels — there is nothing to remember and nothing to
 * misread, which the old ordinal names (`four` = 16) could not claim. The ladder
 * is fixed: 4, 8, 12, 16, 20, 24, 32, 40, 48. A gap that is not on it is a bug,
 * not a decision.
 */
/**
 * Spacing ladder.
 *
 * ⚠️ **The names are step names, not dp values.** `x16` is "the sixteenth-step
 * slot", and it currently resolves to 12. They were literal once; the ladder was
 * compressed when the interface was scaled down so the artwork would out-weigh
 * the chrome around it, and renaming ~470 call sites to chase the numbers would
 * have been a far larger and riskier diff than the change itself. Read the value
 * here, never infer it from the name. (Tailwind's `p-4` is 16px on the same
 * principle.)
 *
 * `x4` is the atom and did not move — below 4 there is no meaningful gap.
 * Everything above it lost roughly a quarter, which is where the "zoomed in"
 * feeling actually lived: a 16dp page margin and 24dp between sections are what
 * made a 74dp cover look like an incidental thumbnail.
 */
export const Spacing = {
  x4: 4,
  x8: 6,
  x12: 10,
  x16: 12,
  x20: 16,
  x24: 18,
  x32: 24,
  x40: 30,
  x48: 36,
} as const;

/**
 * Radii. See DESIGN.md § 5.
 *
 * The UI is deliberately not highly rounded: small corners keep the artwork the
 * roundest thing on screen. The scale is `none`…`lg` plus a pill; the role
 * aliases below map onto it and are what components should actually reach for.
 *
 * Naming by role is what keeps them in place — `Radius.card` cannot drift onto a
 * button the way `md` could.
 */
export const Radius = {
  none: 0,
  xs: 2,
  sm: 3,
  md: 5,
  lg: 8,
  /** Chips, badges, progress tracks, avatar rings. */
  pill: 999,

  /** Game covers, screenshots, thumbnails — anything rectangular and pictorial. */
  image: 4,
  /** Every button, icon button and control. */
  control: 6,
  /** Cards and modular surfaces. */
  card: 6,
  /** Text fields and the search bar. */
  input: 6,

  /*
   * Preserved — the physical game case keeps its own radii. See DESIGN.md § 5.3.
   *
   * `caseImage` was the same number as `image` under the previous scale and is
   * not under this one, so they are separate tokens on purpose: folding them
   * back together would silently redesign the case. `caseImage` covers both the
   * artwork inside the case window and the hairline frame around the PC/mobile
   * cover that stands in when a platform has no case.
   */
  caseImage: 12,
  caseSpine: 3,
} as const;

/**
 * Type scale. See DESIGN.md § 2.
 *
 * Each step pairs a size, a line height and a *family* (see `FontFamily`: on
 * Android the weight has to be the family or it is ignored). Nothing here sets
 * `fontWeight` — the family carries it.
 *
 * Structural steps are `display` and `h1`–`h6`; prose is `body` / `bodySmall`;
 * `caption` and `label` are the metadata steps; `button` is control text.
 * Hierarchy is carried by weight and colour before size — the gaps between the
 * heading steps are deliberately small.
 *
 * **Tracking is in points, not em.** React Native has no `em`, so DESIGN.md's
 * relative values are resolved against each step's own size: -0.02em on 32
 * becomes -0.64, 0.08em on 11 becomes 0.88. Changing a step's size means
 * recomputing its tracking.
 */
export const Type = {
  display: { fontSize: 26, lineHeight: 31, fontFamily: FontFamily.bold, letterSpacing: -0.52 },
  h1: { fontSize: 23, lineHeight: 28, fontFamily: FontFamily.bold, letterSpacing: -0.35 },
  h2: { fontSize: 19, lineHeight: 24, fontFamily: FontFamily.bold, letterSpacing: -0.19 },
  h3: { fontSize: 16, lineHeight: 21, fontFamily: FontFamily.bold },
  h4: { fontSize: 14, lineHeight: 19, fontFamily: FontFamily.bold },
  h5: { fontSize: 13, lineHeight: 18, fontFamily: FontFamily.bold },
  h6: { fontSize: 11, lineHeight: 15, fontFamily: FontFamily.bold, letterSpacing: 0.22 },

  body: { fontSize: 13, lineHeight: 19, fontFamily: FontFamily.regular },
  /* Long-form reading — an article or review body, not UI copy. Deliberately
     looser than `body`: those two screens are the ones people actually read. */
  prose: { fontSize: 15, lineHeight: 24, fontFamily: FontFamily.regular },
  bodySmall: { fontSize: 12, lineHeight: 16, fontFamily: FontFamily.regular },

  /*
   * 10 is the floor. Below this the metadata steps stop being small text and
   * start being unreadable — iOS puts its legibility guidance at 11pt and this
   * is already a point under it, which is affordable for a timestamp or a count
   * and would not be for anything you have to actually read. Do not shrink
   * these two further; take it out of the steps above instead.
   */
  caption: { fontSize: 10, lineHeight: 13, fontFamily: FontFamily.regular, letterSpacing: 0.2 },
  label: {
    fontSize: 10,
    lineHeight: 13,
    fontFamily: FontFamily.medium,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  button: { fontSize: 13, lineHeight: 18, fontFamily: FontFamily.semibold },

  /*
   * Preserved — the physical game case keeps its own type. See DESIGN.md § 2.3.
   *
   * These are the exact metrics the case rendered at before this scale was
   * adopted, pinned so its appearance did not move with the migration. Do not
   * use them anywhere else and do not tidy them onto `h1`/`h6`: `h1` grows the
   * placeholder letter by 4, and `h6`'s bold weight widens the uppercase edition
   * badge enough to truncate it on the 108dp case.
   */
  caseTitle: { fontSize: 24, lineHeight: 30, fontFamily: FontFamily.bold },
  caseEdition: { fontSize: 12, lineHeight: 16, fontFamily: FontFamily.medium },
} as const;

/**
 * Score numeral sizes. See DESIGN.md § 15.
 *
 * The score is a bare coloured numeral at 700, so it sits outside the type scale
 * — its size is chosen by how much room the score has, not by where it falls in
 * a document hierarchy. `inline` is body height, for a feed row where the score
 * is one fact among several; `hero` is the headline number on a review page.
 */
export const ScoreSizes = {
  inline: 13,
  medium: 19,
  large: 27,
  hero: 38,
} as const;

/**
 * Elevation. See DESIGN.md § 6.
 *
 * Depth is carried by **two** things working together: the surface step
 * (`background` → `surface` → `surfaceElevated` → `surfaceSelected`) and a
 * shadow on top of it. The step still does most of the work — a shadow alone is
 * nearly invisible against #121212 — but the shadow is what makes an element
 * read as sitting *above* the page rather than being painted on it.
 *
 * Four interface tiers, and they are deliberately restrained. On a near-black
 * page a large soft shadow does not look like depth, it looks like a grey
 * smudge; the lift comes from a tight radius and a short offset, not from
 * opacity.
 *
 *   card     a block resting on the page
 *   control  something you can press
 *   raised   pressed, active, or floating above siblings
 *   overlay  a dock, popover, sheet or modal — off the page entirely
 *
 * **The ceiling is the game case.** `game-case.tsx` casts at opacity 0.45,
 * radius 18, offset (6, 12) — strictly larger than `overlay` in opacity, offset
 * and radius, and the only shadow in the app with a horizontal component. That
 * gap is not decoration: the case is a depicted physical object and everything
 * here is interface. If an interface tier ever grows past `overlay`, the case
 * stops reading as the one real thing on the shelf. See DESIGN.md § 6.1.
 */
export const Elevation = {
  none: {},
  card: Platform.select({
    ios: {
      shadowColor: Palette.shadowInk,
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    android: { elevation: 2 },
    default: {},
  }),
  control: Platform.select({
    ios: {
      shadowColor: Palette.shadowInk,
      shadowOpacity: 0.24,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    android: { elevation: 3 },
    default: {},
  }),
  raised: Platform.select({
    ios: {
      shadowColor: Palette.shadowInk,
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
    },
    android: { elevation: 6 },
    default: {},
  }),
  overlay: Platform.select({
    ios: {
      shadowColor: Palette.shadowInk,
      shadowOpacity: 0.38,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 10 },
    default: {},
  }),
} as const;

/**
 * Motion. Short and ease-out, and only where it helps you understand what moved.
 */
export const Motion = {
  fast: 150,
  normal: 200,
  slow: 300,
  /** Scale applied while a card or button is held down. */
  pressScale: 0.98,
} as const;

/** Minimum tap target, per both platforms' guidelines. Nothing tappable is smaller. */
export const TapTarget = 44;

/** Portrait box art. Every poster in the app uses this ratio. */
export const PosterAspectRatio = 2 / 3;
/** Landscape key art (Steam headers, IGDB artworks). */
export const HeroAspectRatio = 16 / 9;

/**
 * How much of the display a full-bleed hero fills.
 *
 * Sized against the screen rather than the art's own 16:9, because the hero is
 * the page's opening statement and 16:9 on a tall phone is a 26%-high band — a
 * banner above the content rather than a backdrop behind it. At 38% the art
 * carries the top of the screen the way it does on a store page.
 *
 * The trade is a centre crop: a 16:9 source shown at ~1.2:1 loses its outer
 * thirds. Key art is composed centrally, and `heroHeightFor` never returns less
 * than the untouched 16:9 height, so wide displays keep the whole frame.
 */
export const HeroHeightRatio = 0.38;

export const MaxContentWidth = 800;

/**
 * Design tokens.
 *
 * Dark only, and never true black. The page is #14171b and depth is built from
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

import { ensureContrast, mix, readableInk, tint, withAlpha } from '@/lib/color';
import { generateDynamicTheme, type DynamicThemeColors } from '@/theme/dynamic-color';

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
     * Was #767676 (4.12:1 on the page), then #808080, which cleared the *page*
     * at 4.74:1 and stopped there. That was the bug: this token is used on
     * cards far more often than on the page, and #808080 measured **4.32:1 on
     * `surface`, 3.93:1 on `surfaceElevated` and 3.63:1 on `surfaceSelected`**
     * — failing AA on all three of the surfaces it actually lands on, at 10px.
     *
     * #8F8F8F clears every step the app has a fill for: 5.79 page, 5.27
     * surface, 4.80 elevated. (`surfaceSelected` reaches 4.44, 0.06 short; no
     * call site puts this token on that fill — it carries `textSecondary`.)
     *
     * **The cost, stated plainly:** the gap to `textSecondary` narrows from 40
     * RGB units to 25 (5.79:1 against 7.88:1 on the page). Two quiet steps that
     * close is the price of the quieter one being legible on a card, and it is
     * the right way round — a tier nobody can read is not a tier.
     */
    textMuted: '#8F8F8F',

    /**
     * The page. Never true black: #000 on OLED smears on scroll and kills the
     * sense of depth the surface steps are built on.
     *
     * A cool near-black rather than the neutral #121212 this shipped with. It is
     * fractionally lighter (luminance 0.0084 against 0.0061), which costs every
     * ink on the page about 0.2 of a contrast point — the worst case, `danger`,
     * goes 5.57:1 → 5.34:1 and nothing drops below AA.
     *
     * **The surface step above it is what actually moved.** `surface` measured
     * 1.100:1 against the old page and measures 1.055:1 against this one, so a
     * card separates about half as strongly as it used to. The greys are still
     * neutral while the page is not, which is the other half of the same
     * decision — see § "State of the code" in DESIGN.md.
     */
    background: '#14171b',
    /**
     * Cards and the tab bar. One perceptible step off the page.
     *
     * **The whole ladder is on the page's hue now.** These four were neutral
     * greys (#1C1C1C / #242424 / #2A2A2A / #202020) sitting on a cool near-black
     * page — the inconsistency DESIGN.md's "State of the code" already flagged,
     * and it read as it sounds: a warm-neutral card on a blue-green page.
     *
     * `surface` is the given value; the other three take its hue (206°) and
     * saturation (0.127) at **their own original lightness**, so the ladder's
     * spacing is exactly what it was and only its colour temperature moved.
     * Every ink measures fractionally *better* than before — `text` 15.73:1
     * (was 15.63), `textSecondary` 7.21 (7.17), `textMuted` 5.30 (5.27) — and
     * the card-against-page step is unchanged at 1.049:1 (was 1.055).
     *
     * This is the fixed-colour ladder and nothing on a game's own screens uses
     * it: those run on `accentRoles`, which derives its surfaces from the
     * artwork. See CLAUDE.md, "The room is dark".
     */
    surface: '#181C1F',
    /** Nested surfaces — a block inside a card, a chip, a thumbnail well. */
    surfaceElevated: '#1F2529',
    /** Selected / pressed surface, and the chip fill. */
    surfaceSelected: '#252B2F',
    /** Text fields and the search bar: darker than a card, so an input reads as
     *  a recess rather than as another card. */
    input: '#1C2124',

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
     * Tuned as a set against the near-black page, not picked individually:
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

    /**
     * Review prose, and only review prose.
     *
     * A cool muted grey rather than `textSecondary`'s neutral #A8A8A8. Body copy
     * set in a serif at reading length wants to be *quieter* than interface
     * text, not the same brightness — a thousand words at `text` is a wall, and
     * at `textSecondary` it still reads as a UI string that happens to be long.
     * This is the colour of ink on a page: present, unemphatic, and carrying the
     * same blue-green cast as the surface under it. 5.81:1 on the page, 5.54:1
     * on a card — comfortably past AA at the size prose is set.
     */
    proseInk: '#8A949A',

    /**
     * A liked review's heart.
     *
     * Not `danger`. The app aliased the two because both are "a red-ish glyph",
     * and it was always a category error: `danger` means *this will destroy
     * something* and appears on delete confirmations, while a like is an
     * endorsement. One warm amber, used where a like is the subject of the row
     * rather than one icon in a bar. 8.67:1 on the page.
     */
    liked: '#FF9D35',

    /* Same lift as `scoreLow`, and for the same reason: `<Button variant="danger">`
       renders this as its label on `surfaceElevated`, where #EF4444 was 4.13:1. */
    danger: '#F35555',
    success: '#4ADE80',

    /*
     * The ambient glow in Home's top-left corner. See `ui/soft-glow.tsx`.
     *
     * `glowCore` was #3A2050 and the glow was **invisible on a device** — not
     * dim, invisible. That hex is 1.34:1 against the page at *full* opacity, and
     * the glow never runs at full opacity: after the radial falloff and the blur
     * the brightest on-screen pixel measured #1A151E, which is 1.04:1. There was
     * nothing to see because there was nothing there.
     *
     * #6B4C9A is 2.79:1 at full strength, which lands the composited corner
     * around 1.7:1 — a glow you can see, that still could not be mistaken for a
     * surface. The old value survives as `glowEdge`, where it is doing the job
     * it is actually suited to: the *outer* half of the ramp, where the light is
     * meant to be nearly gone.
     *
     * Not part of the identity system and not available to it. This is the one
     * decorative colour in the app, it appears in exactly one place, and it is
     * fixed rather than derived precisely so Home does not shift hue with
     * whatever game happens to be on it.
     */
    glowCore: '#6B4C9A',
    glowEdge: '#3A2050',

    /** Scrim over hero artwork so text stays legible on any cover. */
    scrim: 'rgba(0, 0, 0, 0.6)',
    /** Skeleton placeholder fill. */
    skeleton: '#1F2529',

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
  /**
   * The hue as a **fill**, and on a game's screens it is the loudest thing there.
   *
   * M3's `primary` (primary palette, tone 80) when the accent came from a game
   * (`tonal: true`), the hue exactly as given otherwise. See `accentRoles` for
   * why those are different questions.
   *
   * **Reserved, on a game page, for the masthead.** The review button, an active
   * action key, the live platform key — and nothing else. Its whole job is to be
   * the one saturated thing on a very dark page, which it stops doing the moment
   * a second element wears it.
   */
  color: string;
  /**
   * The hue as **type on a surface**: a link, an active tab label, a glyph.
   *
   * Lifted to 4.5:1 against the lightest surface accented type ever lands on, so
   * clearing AA there clears it everywhere. On a tonal accent that surface is
   * `elevated` below — a control's own fill — rather than the app's grey
   * `surfaceElevated`, because on a game page the grey one never appears.
   */
  onSurface: string;
  /** Near-black or white — whichever is legible *on* `color`. */
  ink: string;
  /**
   * Secondary type on a surface carrying this hue.
   *
   * Near-white with a trace of the accent in it, rather than grey. It was
   * introduced for the scroll gradient, whose brightest stop left every grey
   * token under AA; the gradient is gone from the game page now, but the role
   * outlives it for a quieter reason — on a page whose every surface is hue-tinted
   * a neutral grey reads as a foreign object, and this does not.
   */
  quietInk: string;
  /** 14% fill behind an active chip, pill or badge. */
  wash: string;
  /**
   * The page itself. **Tonal accents only** — it is `background` otherwise.
   *
   * M3's `background` — the neutral palette at tone 10. A game page fills with
   * this instead of running a gradient, which is what gives `color` (tone 80)
   * seven tone steps of headroom to be loud in.
   */
  page: string;
  /** A block sitting directly on the page. One step up from `page`. */
  surface: string;
  /**
   * A **control**: an inactive action key, a platform key, a row inside a card.
   *
   * One step above `card` on purpose, so a control nested inside a card is still
   * visible against it. On the page itself it reads as recessed rather than
   * raised, because everything around it is either darker (the page) or far
   * louder (`color`).
   */
  elevated: string;
  /**
   * `<InfoCard>` — the panels the game page is built from.
   *
   * Slightly lighter than `page` and no lighter: the card is a container, not a
   * highlight, and the thing that has to stand out on that page is the primary
   * button, not the box around the synopsis.
   */
  card: string;
  /** The coloured light an object casts. Alpha, so it works over artwork. */
  glow: string;
  /**
   * The full Material 3 role set this accent was built from.
   *
   * The ten roles above are the app's own vocabulary and cover most of what a
   * screen needs. This is the rest of M3 — `primaryContainer`, the secondary and
   * tertiary families, `outline`, the three `surfaceContainer` steps — for the
   * places that want a role the short list has no name for. A selected chip
   * wants `secondaryContainer`; a hairline wants `outlineVariant`; neither has
   * an equivalent in the ten.
   *
   * Present on the house accent too, seeded from `primary`, so a component may
   * read it unconditionally.
   */
  m3: DynamicThemeColors;
};

/**
 * Build the roles for one hue.
 *
 * ## Two modes, and the difference is where the hue came from
 *
 * `tonal: false` (the default) is the **house blue**. `primary` is a chosen
 * brand colour that already has the right saturation and lightness, and the app
 * outside a game page is grey-surfaced with a fixed `background` — so the roles
 * are the hue itself plus the legacy `tint()`ed surfaces, and nothing about the
 * forty screens on the house accent changes.
 *
 * `tonal: true` is a **game**. The hue is a measurement off box art, the page is
 * about to be built entirely out of it, and every role is read off
 * a Material 3 tonal palette. This is the mode `<AccentProvider>` uses.
 *
 * Keeping both in one function rather than forking it is deliberate: every
 * consumer reads the same seven role names either way, so a shared primitive —
 * `<Button>`, `<InfoCard>`, `<TabBar>` — never learns which kind of screen it is
 * on. Only the values under the names change.
 */
export function accentRoles(hue: string, { tonal = false }: { tonal?: boolean } = {}): AccentRoles {
  if (!tonal) {
    /* The house blue, unchanged. `primary` is a chosen brand colour sitting on a
       fixed grey `background`, not a measurement, so there is nothing for a
       tonal palette to derive — and running it through one would relight the
       forty screens that are not about a game. */
    return {
      color: hue,
      onSurface: ensureContrast(hue, Colors.dark.surfaceElevated, 4.5),
      ink: readableInk(hue),
      quietInk: mix('#FFFFFF', hue, 0.24),
      wash: withAlpha(hue, 0.14),
      page: Colors.dark.background,
      surface: tint(Colors.dark.surface, hue, SURFACE_TINT),
      elevated: tint(Colors.dark.surfaceElevated, hue, SURFACE_TINT),
      card: tint(Colors.dark.surfaceSelected, hue, SURFACE_TINT),
      glow: withAlpha(hue, 0.42),
      m3: generateDynamicTheme(hue, true),
    };
  }

  /*
   * A game: every role comes off a Material 3 tonal palette seeded by the hue.
   *
   * The mapping is the whole bridge between the app's vocabulary and M3's, and
   * it is deliberately a *rename* rather than a translation — each legacy role
   * resolves to the M3 role that answers the same question, so the twenty-odd
   * components already reading `accent.card` or `accent.elevated` get M3 colours
   * without one of them being edited.
   *
   *   page     → background              neutral  10   the screen fill
   *   surface  → surface                 neutral  10   a block on the page
   *   card     → surfaceContainer        neutral  20   <InfoCard>
   *   elevated → surfaceContainerHigh    neutral  24   controls, rows in cards
   *   color    → primary                 primary  80   the one loud fill
   *   ink      → onPrimary               primary  20   type on that fill
   *   quietInk → onSurfaceVariant  neutralVariant 80   secondary type anywhere
   *
   * Two things this buys that the previous HSL ramp could not. **The tones are
   * perceptual**: HCT tone 20 is the same lightness at every hue, where HSL
   * lightness is not — which is why the old ramp needed per-role saturation
   * tuning to look even across the wheel, and why its yellows read brighter than
   * its blues at identical values. And **there is a second and third accent
   * family** (`secondary`, `tertiary`) for the first time, reachable through
   * `m3` below.
   *
   * What it costs, and it is worth stating plainly: M3's neutrals carry chroma 6
   * (neutral) and 8 (neutralVariant), so a page built from them is far closer to
   * grey than the deeply tinted `#191307` the HSL ramp produced from the same
   * seed. That is Material's judgement rather than an accident — the colour is
   * meant to live in the accents, not the substrate. `TONES` is gone; turning
   * the page back up means raising the neutral palettes' chroma in
   * `dynamic-color.ts`, in one place, for every role at once.
   */
  const m3 = generateDynamicTheme(hue, true);

  return {
    color: m3.primary,
    /* Already tone 80 against a tone-20/24 surface — comfortably past AA — so
       `ensureContrast` is a floor that never fires here rather than a lift. It
       stays because a future variant or contrast level could change that, and a
       silent drop under 4.5:1 is exactly what this role exists to prevent. */
    onSurface: ensureContrast(m3.primary, m3.surfaceContainerHigh, 4.5),
    ink: m3.onPrimary,
    quietInk: m3.onSurfaceVariant,
    wash: withAlpha(m3.primary, 0.14),
    page: m3.background,
    surface: m3.surface,
    elevated: m3.surfaceContainerHigh,
    card: m3.surfaceContainer,
    glow: withAlpha(m3.primary, 0.42),
    m3,
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
 *
 * ## The two italics, and why they are not `fontStyle`
 *
 * Exactly the same trap as weight, and it caught this app once already: an
 * empty-state line on the review screen carried `fontStyle: 'italic'` over
 * `Inter_400Regular` and rendered upright on Android, because a custom family
 * has no oblique to synthesise from either. Italic is a *family* here too.
 *
 * They exist for **user-written emphasis and nothing else** — `*italic*` and
 * `**bold**` in a collection's description, via `<RichText>`. No token on the
 * type scale reaches for them, and none should: the scale separates by size and
 * weight, and an italic step would be a third axis for chrome that has no use
 * for one. Two faces rather than four because emphasis inside body copy is the
 * only place they appear, and body copy is regular or bold.
 */
/**
 * The app's two families, and the line between them is a rule.
 *
 * **Sans is the interface. Serif is the writing.** Inter carries every label,
 * button, tab, count and caption in the app — it is the voice of the software.
 * Source Serif 4 carries **reviews and nothing else**: the game's title on a
 * review, the review's own prose, and the pull quote in a feed card. That
 * contrast is the whole point — it is what makes a review read as something a
 * person wrote rather than as another screen of app chrome.
 *
 * The brief this came from names Tiempos and Graphik. Both are commercial
 * (Klim / Commercial Type) and cannot ship in a bundle. Inter stands in for
 * Graphik — a neo-grotesque at the same width and colour, and already here.
 * Source Serif 4 stands in for Tiempos: Times-descended, drawn for screens,
 * large x-height, low stroke contrast. Neither is a tracing; both do the job the
 * brief is actually asking for, which is the sans/serif split above.
 *
 * **Every weight is its own family name.** Android will not synthesise a bold or
 * an oblique from a custom font, so `fontWeight: '700'` on Inter silently
 * renders regular. Reach for a family, never a weight.
 *
 * `light` exists for one thing: the release year beside a review's title, where
 * a year has to recede from a bold serif without getting smaller.
 */
export const FontFamily = {
  light: 'Inter_300Light',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  italic: 'Inter_400Regular_Italic',
  boldItalic: 'Inter_600SemiBold_Italic',

  /** Review prose. Regular weight, body sizes. */
  serif: 'SourceSerif4_400Regular',
  /** A review's byline and pull quotes. */
  serifSemibold: 'SourceSerif4_600SemiBold',
  /** The game's title on a review page — the one headline in the app. */
  serifBold: 'SourceSerif4_700Bold',
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
  /*
   * The one step above the compressed ladder, and it is not compressed: 48 is
   * 48. It exists for a single job — the gap *between* Home's sections — where
   * the point is that the interval is unmistakably larger than any spacing
   * inside a section. Compressing it to 36 would put it a hair above `x40`'s 30
   * and the distinction would stop reading.
   */
  x64: 48,
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
  /**
   * The game page's content cards — `<InfoCard>` and nothing else yet.
   *
   * A second card radius, which needs an argument. `card` (6) is the app's
   * *list* shape: a review row, a tile, a block in a stack, where the corner is
   * a softening and the eye reads a column of near-rectangles. The Overview tab
   * is not a list — it is a page of self-contained panels, each about a
   * different subject, and Material 3's own card scale puts that shape at 12-20
   * rather than at 6. 18 is where a 340dp-wide panel reads as an object with
   * edges instead of a paragraph with rounded corners.
   *
   * It is deliberately far from `Radius.control` (6): these panels *contain*
   * buttons, and a container sharing its child's corner reads as a single
   * oversized control.
   */
  cardLarge: 18,
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

  /* -------------------------------------------------------------------------
   * Reviews, and nothing else in the app.
   *
   * **The serif is the rule and these seven steps are its whole extent.** A
   * review is the one thing in this product a person *wrote*, and setting it in
   * the same grotesque as the tab bar makes it read as another screen of app
   * output. The sans/serif split is what makes it read as a piece of writing —
   * which is the entire argument for having a second family at all.
   *
   * So: serif for the editorial content (the game's title on a review, the
   * prose, the excerpt in a feed card) and sans for everything *about* it (the
   * byline, the year, the playthrough facts, the like count). Do not reach for
   * any of these outside a review surface; a serif game title in a search result
   * would spend the distinction for nothing.
   * ---------------------------------------------------------------------- */

  /** The game's name on a review page. The one headline in the app. */
  reviewTitle: { fontSize: 22, lineHeight: 26, fontFamily: FontFamily.serifBold },
  /** The same, on a feed card, where it shares a column with the artwork. */
  reviewTitleSmall: { fontSize: 17, lineHeight: 21, fontFamily: FontFamily.serifBold },
  /*
   * The prose. Deliberately looser than `prose`: 26 on 16 is a 1.63 ratio where
   * the sans body runs 1.6 on 15 — a serif at reading length needs the extra
   * leading to keep the lines from knitting together, and this is the one block
   * in the app somebody reads rather than scans.
   */
  reviewProse: { fontSize: 16, lineHeight: 26, fontFamily: FontFamily.serif },
  /** The excerpt on a feed card, beside the artwork. */
  reviewExcerpt: { fontSize: 14, lineHeight: 22, fontFamily: FontFamily.serif },
  /** The release year beside a review's title. Recedes without shrinking. */
  reviewYear: { fontSize: 15, lineHeight: 20, fontFamily: FontFamily.light },
  /** "Review by <name>". Sans, because it is a fact about the piece. */
  reviewByline: { fontSize: 13, lineHeight: 18, fontFamily: FontFamily.semibold },
  /** The playthrough block: platform, hours, platinum, date. Tight and compact. */
  reviewMeta: { fontSize: 12, lineHeight: 17, fontFamily: FontFamily.semibold },

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
 * nearly invisible against a near-black page — but the shadow is what makes an
 * element read as sitting *above* the page rather than being painted on it.
 *
 * The shadow carries proportionally more of that work since the page moved to
 * `#14171b`: the `background` → `surface` step is now 1.055:1 rather than
 * 1.100:1, so an element that reaches for a `borderWidth` because it "does not
 * read" should reach for the next `Elevation` tier first.
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
  /**
   * How far a card or button shrinks while held.
   *
   * The default for `<PressableScale scaleTo>`, and only half the story since
   * that component learned about Reduce Motion: under the OS setting it holds
   * still and dims instead, because a scale is spatial movement while press
   * feedback is an affordance, and answering the first by deleting the second
   * would be the wrong trade. This value is the motion-on path.
   */
  pressScale: 0.98,
} as const;

/**
 * Minimum tap target. Nothing tappable is smaller.
 *
 * **The two platforms do not agree, and this used to claim they did.** The HIG
 * sets 44pt; Material sets 48dp with 8dp of separation. A single 44 satisfied
 * iOS and quietly shipped four points short on every Android device — which is
 * the whole meaning of `adaptive` in PRODUCT.md: one design language, each
 * platform's own guarantees.
 *
 * Read it, never restate it. A hard-coded 44 in a component is the same bug
 * this constant exists to prevent, one file further down.
 */
export const TapTarget = Platform.select({ android: 48, default: 44 }) as number;

/**
 * The floating top bar's content row, above the safe-area inset.
 *
 * 56 on both platforms. The native stack header this replaced was 44pt on iOS
 * and 56dp on Android; matching that split would put the same title at two
 * different heights for no reason now that the bar is drawn rather than
 * platform-supplied, and 44 is too tight for the title-plus-subtitle variant.
 *
 * Read it through `useHeaderHeight()`, which adds the inset. Lives here rather
 * than in `<FrostedTopBar>` so the hook and the component can both have it
 * without importing each other.
 */
export const TopBarHeight = 56;

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

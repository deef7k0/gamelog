/**
 * Design tokens.
 *
 * Dark only, and never true black. The page is #0B0A0D and depth is built from
 * *surface steps* — background → surface → surfaceElevated → surfaceSelected —
 * plus a hairline edge, rather than from shadows, which are close to invisible
 * on a dark screen anyway. A card looks lifted because it is lighter than what
 * is behind it.
 *
 * **Controls speak one language: dark, rounded, edged, lit in the house blue.** A
 * premium music player rather than a settings form — large radii, a 1px edge in
 * white at a few percent, generous height, and the accent spent only on what is
 * selected, focused or primary. See DESIGN.md § 9 for the families and
 * `components/ui/` for the primitives that implement them.
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
 * `primary` is PlayStation blue and is the *house* colour — every screen that
 * is not about one specific game runs on it, which is what keeps the app from
 * becoming a fruit salad. (It was lavender for one pass of the control
 * migration; the owner took it back to blue.) Identity shifts the accent only
 * where there is a game to shift it to, and a game's own screens keep their
 * Material 3 palette.
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
    /*
     * The three inks stayed neutral through the move to the violet-black room.
     * The music-app reference proposed violet-tinted ones; they are within a
     * few RGB units of these, and these are also what the physical game case's
     * printed back is set in — a protected feature that must render exactly as
     * it did. Hierarchy is brightness: 18.1:1, 8.3:1 and 6.1:1 on the page.
     */
    text: '#F5F5F5',
    textSecondary: '#A8A8A8',
    /**
     * The quiet step — timestamps, counts, captions.
     *
     * Was #767676 (4.12:1 on the old page), then #808080, which cleared the
     * page and failed every card. #8F8F8F clears every fill the app has: 6.11
     * page, 5.72 surface, 5.34 elevated, 4.86 selected. The reference's #77727F
     * was not adopted: 4.23:1 on the page and 3.70:1 on `surfaceElevated`,
     * under AA wherever it would actually land, at the 10px this is set at.
     *
     * It is *not* legible on an accent-washed control (4.32:1 on a selected
     * card), so type inside anything selected steps up to `textSecondary`.
     */
    textMuted: '#8F8F8F',

    /**
     * The page. Never true black: #000 on OLED smears on scroll and kills the
     * sense of depth the surface steps are built on.
     *
     * A near-black with a faint cool trace — darker than the #14171b it
     * replaced (luminance 0.0032 against 0.0084) and without that one's
     * blue-grey cast, at the owner's request: darker, not bluer, and not black.
     * The trace (hue 260°, 13% saturation at 4.5% lightness) is too faint to
     * read as a colour; it only keeps the room cool rather than warm-neutral.
     */
    background: '#14171c',
    /**
     * Home's page fill, and only Home's — an experiment with the room's floor,
     * kept to one screen so the rest of the app is unaffected. Change it here.
     *
     * True black for now, which the note above warns against on OLED; that is
     * the thing being tried. The surface ladder was tuned against `background`,
     * so cards on Home separate a little more strongly than elsewhere.
     */
    homeBackground: '#14171c',
    /**
     * Cards and the tab bar. One perceptible step off the page: 1.076:1 on
     * `background` (#14171c). The owner's colour.
     *
     * **Solid, and it has to be.** It was tried at 62% opacity (`#1b1e249f`),
     * which broke three things quietly: `tint()` and `withAlpha()` read only a
     * plain `#RRGGBB`, so the house accent's tinted card came back see-through
     * and the News dock's 80% wash came back at 62%; and on Android a
     * translucent view with `elevation` shows its own shadow through itself, a
     * grey smudge inside every card. Keep it a six-digit hex.
     *
     * This is the fixed-colour ladder and nothing on a game's own screens uses
     * it for their surfaces: those run on `accentRoles`, which derives them from
     * the artwork. See CLAUDE.md, "The room is dark".
     */
    surface: '#1b1e24',
    /**
     * Nested surfaces, and the resting fill of a control — a secondary button,
     * an icon button, an unselected chip. The reference's "interactive surface".
     */
    surfaceElevated: '#1B1A20',
    /** Pressed and neutral-selected fill: one step above a resting control. */
    surfaceSelected: '#24222A',
    /**
     * The well of a text field, a select field and the search bar — the owner's
     * reference, SimpMusic's name field: its `onSurfaceVariant` at 8%, which
     * renders #0F0F0F on a black page. No border: the fill alone draws it.
     *
     * Translucent rather than a hex so the lift is the same over every floor it
     * sits on — the page, Home's own `homeBackground`, a game's Material 3 page.
     */
    input: 'rgba(255, 255, 255, 0.06)',
    /**
     * The fill of every action button and icon button — the reference's
     * "Create room": `onSurfaceVariant` at 12%, #181818 on black. A step
     * lighter than a field's well, so an action and the field it acts on read
     * as two different objects. Translucent for the same reason as `input`.
     */
    controlFill: 'rgba(255, 255, 255, 0.094)',
    /** `controlFill` while held: a step brighter, eased in by `PressableScale`. */
    controlPressed: 'rgba(255, 255, 255, 0.15)',
    /**
     * The label on an action button: a soft light grey rather than white, as the
     * reference sets it (#D6D4D9 measured). 12.4:1 on `controlFill` over black.
     */
    controlInk: '#D6D6D6',
    /**
     * The resting edge of a *choice* — a selection card, a filter or sort pill,
     * an unchosen segment: the reference's `onSurfaceVariant` at 20%. Choices
     * are outlined and actions are filled; the edge is what says "one of
     * these", where a filled grey pill says "do this".
     */
    outline: 'rgba(255, 255, 255, 0.16)',

    /** Overlays for touch feedback. Layered *over* a surface, never instead. */
    hover: 'rgba(255, 255, 255, 0.04)',
    pressed: 'rgba(255, 255, 255, 0.07)',

    /**
     * The subtle edge: dividers, and the 1px outline every resting control
     * carries. 1.15:1 against the page — visible as an edge, never as a line
     * you read. Controls are drawn by this edge and a surface step, not by a
     * shadow.
     */
    border: 'rgba(255, 255, 255, 0.07)',
    /**
     * The strong edge: an open disclosure, an unchecked box's ring, a rule that
     * must hold on the page (1.33:1). Unchanged at 12% — the game case's
     * PC-cover frame is drawn in it, and that frame is protected.
     */
    borderStrong: 'rgba(255, 255, 255, 0.12)',
    /**
     * The edge of box art: one hairline of cool white, drawn *inside* a cover's
     * own edge and over its artwork.
     *
     * The owner's reference — the poster on a film's page in Letterboxd — and
     * its numbers: `#DDEEFF` at 35%, measured off the screenshot as `#4B4E55`
     * where the art under it is black. Over the art, not round it, which is why
     * it is an alpha and not a grey: on a dark cover it is a lit edge that stops
     * the box dissolving into a near-black page, and on a white one it is
     * nothing at all, which is right — a white box needs no help.
     *
     * `<Poster>` draws it on every portrait cover at the box-art corner, and
     * Surprise Me's entry deck, which draws its covers by hand, uses it too.
     * Not the game case's, whose framed cover keeps `borderStrong` above.
     */
    coverEdge: 'rgba(221, 238, 255, 0.35)',

    /**
     * The house accent. PlayStation blue, and the app's own colour: the tab
     * bar, the home feed, search, notifications and every screen that is not
     * about one particular game.
     *
     * **An accent, not a theme.** Most of any screen stays black, near-black,
     * grey and white; the blue marks what is selected, focused or primary, and a
     * screen with six blue things has no primary action.
     *
     * **Fills only.** At 3.94:1 on the page it is below AA for text — right
     * under white on a filled button (5.01:1), wrong for a word. Type that wants
     * to look like the house colour uses `primaryText`, and so do the selected
     * and focus states (`accentRoles`), because a 14% wash of *this* blue over
     * near-black comes out darker than the resting control surface.
     */
    primary: '#0070CC',
    /** White on the blue fill, 5.01:1. */
    onPrimary: '#FFFFFF',
    /**
     * The same blue, lifted so it can carry a label: 6.07:1 on the page, 5.31 on
     * `surfaceElevated`, 4.83 on `surfaceSelected`.
     *
     * Not a second accent — a legibility variant of the first. Anywhere the blue
     * is *type* (a link, an active tab label, "See all") reaches for this;
     * anywhere it is a *fill* keeps `primary`. It is also the base the house
     * `wash`, `edge` and `ring` are built from.
     */
    primaryText: '#2E93E8',
    /**
     * A wash of the accent — the house `wash`: `primaryText` at 16%. Lighter
     * than the resting control fill it replaces, which is what lets it mark a
     * selected control by brightness as well as by hue.
     */
    primaryMuted: 'rgba(46, 147, 232, 0.16)',
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
     * Log status. Five states, five hues, aliased onto the ramp.
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
    /**
     * Gold, for `paused` (0022): the amber light between going and stopped.
     *
     * An alias of `identityGold`, not a new hex — a meaning joins the ramp. It
     * sits apart from the four above on hue *and* on luminance (it is the
     * lightest of the five), and a reader who cannot tell gold from jade still
     * has the pause glyph and the word, which every status ships beside it.
     */
    statusPaused: '#F3C24B',

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
     * The Must Play label's disc (0034): a moderator's pick, drawn as a badge on
     * a cover and in the game page's stats strip.
     *
     * An alias of `identityJade`, not a new hex — a meaning joins the ramp, as
     * `statusPaused` did. Green at the owner's direction (it was ember): the
     * badge is the one thing in this app that sits *on* box art in a colour,
     * and it has to hold on any cover — at 10.6:1 against the dark ring drawn
     * round it, the disc reads on a white box and a black one alike. The face
     * on it takes `readableInk` — near-black — so the mark is never a second
     * hue, and its teeth take the opposite ink.
     */
    mustPlay: '#43D98C',

    /**
     * Review prose, and only review prose.
     *
     * A muted grey rather than `textSecondary`. Body copy at reading length
     * wants to be *quieter* than interface text, not the same brightness — a
     * thousand words at `text` is a wall, and at `textSecondary` it still reads
     * as a UI string that happens to be long. This is the colour of ink on a
     * page: present, unemphatic, and carrying the same violet trace as the
     * surface under it (it was #8A949A, blue-green, when the room was).
     * Same luminance as before: 6.29:1 on the page, 5.90:1 on a card.
     *
     * It was chosen for a serif and outlived it: now that a review is set in
     * Inter like everything else, this ink is what still tells a page of
     * somebody's writing from a page of the app's own text.
     */
    proseInk: '#958F9D',

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
     * Home's ambient light in its top-left corner (`ui/ambient-light.tsx`), and
     * `<SoftGlow>`'s default colours.
     *
     * These were drawn for an earlier, much stronger corner glow — a `<SoftGlow>`
     * in the same corner — which was replaced by the soft ambient light because
     * it read as a lit corner rather than as light. The notes below are that
     * glow's history, and still explain the values.
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
     * decorative colour in the app, and it is fixed rather than derived
     * precisely so Home does not shift hue with whatever game happens to be on
     * it. It stays violet beside the blue house accent, as it always had: the
     * light is atmosphere, not chrome, and does not have to match the controls.
     */
    glowCore: '#6B4C9A',
    glowEdge: '#3A2050',

    /**
     * The fill of a review card in a list (`log-card.tsx`), and nothing else's.
     *
     * **Almost the page**: `background` three levels darker in each channel,
     * 1.03:1 against it. The owner's direction — "closer to the background
     * color, almost the same but ever so slightly different" — and then "only
     * a solid background color". So the card is a flat piece of the page's own
     * colour, a shade under it, and what separates it from the page is that
     * shade and its shadow.
     *
     * It is not `surface`, which is a step *above* the page (1.08:1) and is
     * what every other card in the app is filled with. This sits a step below.
     *
     * **It follows the page.** The card is on Home (`homeBackground`, the
     * colour the owner tries things on) and on every other list of reviews
     * (`background`); the two are the same hex today. Move either and this
     * moves with it, the same three levels under — `review-card.test.ts` fails
     * if the card drifts from either page or meets it.
     */
    reviewCard: '#111419',

    /**
     * The light ground under somebody else's logo — a platform's, a studio's —
     * when nothing is known about it (`ui/logo-mark.tsx`).
     *
     * The fallback, no longer the rule. Those marks are drawn for white pages
     * and every one used to sit on this plate; each is now measured once and
     * drawn straight on the page, lightened when its ink would be lost, or on a
     * plate of its *own* ground when it is not cut out at all. This is what is
     * left for a logo that could not be measured: a plate the colour of `text`
     * is legible whatever turns out to be on it.
     */
    logoPlate: '#F5F5F5',

    /** Scrim over hero artwork so text stays legible on any cover. */
    scrim: 'rgba(0, 0, 0, 0.6)',
    /** Skeleton placeholder fill. */
    skeleton: '#1B1A20',

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
  /**
   * The fill behind an active chip, pill or badge — and the fill of anything
   * *selected*: a sort pill, a report reason, a tab. A light wash of the hue's
   * legible form; see `HOUSE_STATES` for why it is not a wash of the fill.
   */
  wash: string;
  /**
   * The edge of a selected or focused control.
   *
   * Paired with `wash` it is what "selected" looks like everywhere — a tint
   * inside, a lit edge around it, and the label up a step. The edge is the
   * carrier that survives colour blindness: over the page the house edge
   * measures 2.53:1 against a resting edge's 1.15, a difference of brightness,
   * not of hue.
   */
  edge: string;
  /** `color` while it is held down — a deeper, not a lighter, fill. */
  pressed: string;
  /** The focus ring: a 3dp halo outside the control's edge. */
  ring: string;
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
 * How far `pressed` deepens `color`: toward black on the house accent, toward
 * M3's `onPrimary` — itself near-black — on a game's.
 */
const PRESSED_DEPTH = 0.14;

/**
 * How strong the state roles are, per mode.
 *
 * **Built from the hue's legible form, not its fill.** The house blue is a
 * mid-luminance fill (3.94:1 on the page), and a 14% wash of it over near-black
 * lands *darker* than the resting control surface — a selected pill would look
 * dimmer than the ones around it, and brightness would stop carrying selection
 * for anyone who cannot see the hue. `onSurface` (`primaryText` for the house)
 * is light enough that its wash lifts the fill instead: 0.0137 against the
 * resting 0.0108 in luminance. A game's M3 `primary` is tone 80 and already
 * light, so it takes a slightly softer set.
 */
const HOUSE_STATES = { wash: 0.16, edge: 0.55, ring: 0.3 } as const;
const TONAL_STATES = { wash: 0.14, edge: 0.45, ring: 0.22 } as const;

/**
 * Build the roles for one hue.
 *
 * ## Two modes, and the difference is where the hue came from
 *
 * `tonal: false` (the default) is the **house blue**. `primary` is a chosen
 * brand colour that already has the right saturation and lightness, and the app
 * outside a game page is surfaced from the fixed ladder with a fixed
 * `background` — so the roles are the hue itself plus the legacy `tint()`ed
 * surfaces, and nothing about the forty screens on the house accent moves with
 * any game.
 *
 * `tonal: true` is a **game**. The hue is a measurement off box art, the page is
 * about to be built entirely out of it, and every role is read off
 * a Material 3 tonal palette. This is the mode `<AccentProvider>` uses.
 *
 * Keeping both in one function rather than forking it is deliberate: every
 * consumer reads the same role names either way, so a shared primitive —
 * `<Button>`, `<InfoCard>`, `<TabBar>` — never learns which kind of screen it is
 * on. Only the values under the names change. That is also why a selected sort
 * pill is blue on the Search tab and the game's own colour on its reviews
 * sheet: `wash`, `edge` and `ring` are derived here, from whichever hue is in
 * force.
 *
 * **Computed once per hue and mode, then shared.** Both modes build a Material 3
 * scheme and run luminance-preserving tints, and the house blue is asked for by
 * every control that reads `useAccent()` — so the result is cached, and callers
 * get the same object back. Treat it as immutable.
 */
export function accentRoles(hue: string, { tonal = false }: { tonal?: boolean } = {}): AccentRoles {
  const key = `${tonal ? 'tonal' : 'house'}:${hue}`;
  const cached = accentCache.get(key);
  if (cached) return cached;

  const roles = buildAccentRoles(hue, tonal);
  /* Oldest first out; a Map iterates in insertion order. A game's hue is read
     off its box art, so a long session would otherwise keep every one it saw. */
  if (accentCache.size >= ACCENT_CACHE_SIZE) {
    accentCache.delete(accentCache.keys().next().value as string);
  }
  accentCache.set(key, roles);
  return roles;
}

const accentCache = new Map<string, AccentRoles>();
const ACCENT_CACHE_SIZE = 64;

function buildAccentRoles(hue: string, tonal: boolean): AccentRoles {
  if (!tonal) {
    /* The house blue. `primary` is a chosen brand colour sitting on a fixed
       `background`, not a measurement, so there is nothing for a tonal palette
       to derive — and running it through one would relight the forty screens
       that are not about a game. */
    const ink = readableInk(hue);
    /* The house hue's type twin is a chosen value, `primaryText`, so the tab
       labels, links and selected states all say the same blue. Any other hue's
       is computed. */
    const type =
      hue === Colors.dark.primary
        ? Colors.dark.primaryText
        : ensureContrast(hue, Colors.dark.surfaceElevated, 4.5);
    return {
      color: hue,
      onSurface: type,
      ink,
      quietInk: mix('#FFFFFF', hue, 0.24),
      wash: withAlpha(type, HOUSE_STATES.wash),
      edge: withAlpha(type, HOUSE_STATES.edge),
      pressed: mix(hue, Colors.dark.shadowInk, PRESSED_DEPTH),
      ring: withAlpha(type, HOUSE_STATES.ring),
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
    wash: withAlpha(m3.primary, TONAL_STATES.wash),
    edge: withAlpha(m3.primary, TONAL_STATES.edge),
    /* M3's own pressed state is `onPrimary` layered over `primary`, which is
       what a mix toward the ink computes. */
    pressed: mix(m3.primary, m3.onPrimary, PRESSED_DEPTH),
    ring: withAlpha(m3.primary, TONAL_STATES.ring),
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
 * The app's one family: Inter, for everything.
 *
 * **There were two, and the owner took the second out.** Source Serif 4 set
 * reviews and nothing else — a review's title, its prose, the pull quote on a
 * card — on the argument that a serif is what makes a review read as something
 * a person wrote. The owner's direction: "remove the specific font for reviews
 * and just use the normal one". A review is told apart now by its ink
 * (`proseInk`), its measure and its leading — the `review*` steps in `Type` —
 * and by where it is, not by a second typeface. Do not bring a serif back for
 * "editorial" surfaces; three font files left the build with it.
 *
 * **Every weight is its own family name.** Android will not synthesise a bold or
 * an oblique from a custom font, so `fontWeight: '700'` on Inter silently
 * renders regular. Reach for a family, never a weight.
 *
 * `light` exists for one thing: the release year beside a review's title, where
 * a year has to recede from a bold title without getting smaller.
 */
export const FontFamily = {
  light: 'Inter_300Light',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  italic: 'Inter_400Regular_Italic',
  boldItalic: 'Inter_600SemiBold_Italic',
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
 * Spacing ladder, at the owner's reference's numbers.
 *
 * ⚠️ **The names are step names.** `x16` is the page margin and resolves to 15,
 * not 16. Read the value here, never infer it from the name, and never "fix" a
 * name to match its number.
 *
 * ## SimpMusic's ladder, read from its code
 *
 * The values are the dp SimpMusic lays itself out in, from `HomeScreen.kt`,
 * `AdapterItems.kt`, `FullWidthItems.kt`, `LibraryScreen.kt` and
 * `SearchScreen.kt`: 4 between chips, 8 between a list's items and from art to
 * its title, 12 from a thumbnail to its text and between grid cells, **15 at
 * the side of every page** (Home, Library, every row), 20 and 24 for a sheet's
 * or a setting's inset, 32 for an album's body, 48 at the foot of a scroll.
 *
 * ## What this undid
 *
 * The ladder had been compressed twice — first by a quarter, then a further
 * ~17% from `x12` up — to zoom the chrome out so the artwork out-weighed it:
 * the page margin was 10 and a band's gap 40. At the owner's direction the app
 * now takes SimpMusic's dimensions instead, so the ladder went back to
 * Material's 4dp grid with the reference's 15 for the margin. The controls
 * had been sized to the reference *on* the compressed ladder (a 52dp button,
 * 15 inside a field), and were re-pointed so they kept those sizes.
 */
export const Spacing = {
  x4: 4,
  x8: 8,
  x12: 12,
  /** The page margin: SimpMusic's 15, on Home, Library and every row. */
  x16: 15,
  x20: 20,
  x24: 24,
  /** Between one band of a page and the next, and an album's body inset. */
  x32: 32,
  x40: 40,
  /** The foot of a scroll. */
  x48: 48,
  /*
   * The top of the ladder, for the space under a form whose footer is pinned
   * over it. Bands of a page are `x32` apart — the reference's own interval —
   * not this.
   */
  x64: 64,
} as const;

/**
 * Radii. See DESIGN.md § 5.
 *
 * **Two regimes.** *Interface* is large and soft — the music-app language:
 * controls at 20, fields at 16, cards at 16, sheets at 24, and a pill for
 * anything that filters or tags. *Artwork* keeps its small, square-ish corners
 * (`image`, the case's own radii), because a box is a box: rounding a cover to
 * match the buttons beside it would make it look like one of them.
 *
 * The small steps (`xs`…`lg`) are for details inside a control — a badge, a
 * swatch, a seam — and for the game page's Material 3 cluster, which is shaped
 * by its own rules and did not move.
 *
 * Naming by role is what keeps them in place — `Radius.card` cannot drift onto a
 * button the way `md` could. Nothing uses the same radius as everything: a
 * field is squarer than the button that submits it, and a sheet is rounder than
 * the rows in it, so each reads as a different kind of object.
 */
export const Radius = {
  none: 0,
  xs: 2,
  sm: 3,
  md: 5,
  lg: 8,
  /** Chips, filters, tabs, search, badges, progress tracks, avatar rings. */
  pill: 999,

  /** Game covers, screenshots, thumbnails — anything rectangular and pictorial. */
  image: 4,
  /**
   * Pressable controls that are not buttons — toggles, segments, the log
   * form's status pills. Buttons themselves are full pills (`pill`), as the
   * owner's reference draws them.
   *
   * 20, which on a 48dp control resolves to a soft stadium and on anything 40dp
   * or shorter to a true pill (React Native clamps a radius at half the side).
   * Icon buttons are circles and take no token: `size / 2`.
   */
  control: 20,
  /** Cards and modular surfaces — a review card, a notice, a list tile. */
  card: 16,
  /**
   * The game page's content cards — `<InfoCard>` and nothing else yet.
   *
   * A second card radius, and its argument was made when `card` was 6: the
   * Overview tab is not a list but a page of self-contained panels, each about
   * a different subject, and Material 3's own card scale puts that shape at
   * 12-20. 18 is where a 340dp-wide panel reads as an object with edges instead
   * of a paragraph with rounded corners.
   *
   * **Preserved at 18 through the control migration.** The game page is the
   * one screen that keeps its Material 3 treatment. `card` has since risen to
   * 16 and sits beside it rather than far from it; what separates a panel from
   * the buttons inside it now is the fill step, not the corner.
   */
  cardLarge: 18,
  /**
   * Every field — text, text area, select, search: the reference's 18dp.
   * Squarer than a button's full pill, so a field and the button that submits
   * it read as two different objects.
   */
  input: 18,
  /**
   * The top corners of a bottom sheet, and the corners of a dialog or a menu —
   * anything that sits *above* the page. The roundest interface shape, because
   * everything inside it is less round.
   */
  sheet: 24,

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
 *
 * ## The sizes are SimpMusic's
 *
 * Each step is one of the owner's reference's styles (`Typo.kt`), at its sp:
 * `display` its `titleLarge` (25, an album's name), `h1` `headlineLarge` (23),
 * `h2` `headlineMedium` (20, Home's shelf titles — "Quick picks"), `h3`
 * `titleMedium` (18, a sheet's or a screen's title), `h4` `labelMedium` (16,
 * the artist page's section headings and a setting's name), `h5` `labelSmall`
 * (14, a chip's and a tab's word), `body` `bodyMedium` (13) and `bodySmall`
 * its `bodySmall` (11). `caption` is 11 too — the reference sets nothing
 * smaller that is meant to be read. `h6` and `label` stay at 10: they are
 * badges, which the reference draws smaller still (its LIVE badge is 9).
 *
 * The scale had been zoomed out ~8% with the spacing ladder; it came back up
 * with it. Weights stayed this app's: SimpMusic registers one Poppins file and
 * lets Compose synthesise the rest, which says nothing worth copying.
 */
export const Type = {
  display: { fontSize: 25, lineHeight: 30, fontFamily: FontFamily.bold, letterSpacing: -0.55 },
  h1: { fontSize: 23, lineHeight: 28, fontFamily: FontFamily.bold, letterSpacing: -0.39 },
  h2: { fontSize: 20, lineHeight: 25, fontFamily: FontFamily.bold, letterSpacing: -0.22 },
  h3: { fontSize: 18, lineHeight: 23, fontFamily: FontFamily.bold },
  h4: { fontSize: 16, lineHeight: 21, fontFamily: FontFamily.bold },
  h5: { fontSize: 14, lineHeight: 19, fontFamily: FontFamily.bold },
  h6: { fontSize: 10, lineHeight: 14, fontFamily: FontFamily.bold, letterSpacing: 0.22 },

  body: { fontSize: 13, lineHeight: 19, fontFamily: FontFamily.regular },
  /* Long-form reading — an article or review body, not UI copy. Deliberately
     looser than `body`: those two screens are the ones people actually read. */
  prose: { fontSize: 14, lineHeight: 22, fontFamily: FontFamily.regular },
  bodySmall: { fontSize: 11, lineHeight: 15, fontFamily: FontFamily.regular },

  /*
   * 11, the reference's smallest reading size (`bodySmall`) and iOS's
   * legibility floor. It was 10 while the scale was zoomed out. `label` stays
   * at 10 because it is a badge — uppercase, tracked, a word or two over art —
   * and a badge that grew would no longer fit the covers it sits on. Do not
   * shrink either.
   */
  caption: { fontSize: 11, lineHeight: 14, fontFamily: FontFamily.regular, letterSpacing: 0.2 },
  label: {
    fontSize: 10,
    lineHeight: 13,
    fontFamily: FontFamily.medium,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  /*
   * Control text. 13 semibold — the reference's `titleSmall`, the small label in
   * the middle of a 52dp pill.
   */
  button: { fontSize: 13, lineHeight: 18, fontFamily: FontFamily.semibold },
  /**
   * A form field's label, set *above* the field: small and medium weight, the
   * reference's 11sp Poppins Medium translated to Inter at the 12 it needs to
   * read the same. The field under it is the object; the label names it.
   */
  fieldLabel: { fontSize: 12, lineHeight: 16, fontFamily: FontFamily.medium },
  /**
   * What is typed into a field. **No `lineHeight`, on purpose**: on Android a
   * line height on a `TextInput` clips descenders and fights the vertical
   * centring the field's min-height does. 13, the reference's.
   */
  fieldText: { fontSize: 13, fontFamily: FontFamily.regular },
  /**
   * The name on a selection card — the reference's Server option. Medium, not
   * bold: a choice is read, not announced, and the circle beside it carries
   * which one is on.
   */
  optionTitle: { fontSize: 13, lineHeight: 18, fontFamily: FontFamily.medium },
  /**
   * The title of a row or a card in a list — a game in a collection, a
   * collection in a list of them. The reference's `titleSmall`: 13 semibold,
   * with its supporting line in `bodySmall` under it. Bold is for titles and
   * figures; everything around them is regular and quieter.
   */
  itemTitle: { fontSize: 13, lineHeight: 18, fontFamily: FontFamily.semibold },

  /* -------------------------------------------------------------------------
   * Reviews, and nothing else in the app.
   *
   * **Inter, like the rest.** These steps were the serif's whole extent — a
   * review's title, its prose, the headline and excerpt on a card were set in
   * Source Serif 4 so that writing read as writing. The owner removed the
   * serif (see `FontFamily`), and the steps stayed: they are still the
   * *sizes* of a review surface, and every review screen already asks for them
   * by name. What sets a review apart now is `proseInk`, the looser leading of
   * `reviewProse`, and the page it is on.
   *
   * Still not for use outside a review surface — not because of the face any
   * more, but because a game's title in a search result is a row's title
   * (`itemTitle`), not a headline.
   * ---------------------------------------------------------------------- */

  /**
   * The game's name on a review page. The one headline in the app — `h2`'s
   * size and tracking on a line one tighter, because it stands alone beside a
   * score rather than over a section.
   */
  reviewTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.22,
  },
  /** The same, on a feed card, where it shares a column with the artwork. */
  reviewTitleSmall: { fontSize: 16, lineHeight: 20, fontFamily: FontFamily.bold },
  /**
   * The writer's own headline on a feed card — "One of the best games of all
   * time" — closing the header block beside the box art, under the score and
   * the date. 11 bold: the sans floor is 10, and a headline is one step over a
   * badge.
   */
  reviewHeadlineSmall: { fontSize: 11, lineHeight: 15, fontFamily: FontFamily.bold },
  /*
   * The prose: 14 on 22, the reading step (`prose`).
   *
   * It ran 14/23 while it was a serif, which needs the extra leading to keep
   * its lines from knitting together at length. Inter's x-height is larger and
   * its lines hold apart on less; at 23 a page of it reads as double-spaced.
   * 22 on 14 is 1.57 — still the loosest block in the app, as the one thing in
   * it somebody reads rather than scans should be.
   */
  reviewProse: { fontSize: 14, lineHeight: 22, fontFamily: FontFamily.regular },
  /** The excerpt on a feed card, beside the artwork. */
  reviewExcerpt: { fontSize: 13, lineHeight: 20, fontFamily: FontFamily.regular },
  /** The release year beside a review's title. Recedes without shrinking. */
  reviewYear: { fontSize: 14, lineHeight: 19, fontFamily: FontFamily.light },
  /** "Review by <name>". Sans, because it is a fact about the piece. */
  reviewByline: { fontSize: 12, lineHeight: 17, fontFamily: FontFamily.semibold },
  /**
   * The playthrough block: platform, hours, platinum, date.
   *
   * 13/18, up from 11/16. These are the facts somebody checks *before* deciding
   * whether to read the review — what it was played on, for how long, how far
   * through — and at 11 they were the quietest type on a page whose masthead is
   * a 20px title beside a score tile. They are the one part of that
   * masthead that is information rather than identity, so they get the step.
   *
   * Still under the title and the score, which is the constraint: this reads
   * *after* both, not against them.
   */
  reviewMeta: { fontSize: 13, lineHeight: 18, fontFamily: FontFamily.semibold },

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
  inline: 12,
  medium: 17,
  large: 25,
  hero: 35,
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
 * **Controls do not cast.** Buttons, fields, chips and icon buttons are drawn
 * by a surface step and a 1px `border` — the music-app language keeps shadows
 * to near nothing, and a control that needs more presence gets a brighter edge
 * or a fill, not a tier. `control` survives for the few elements that are
 * genuinely *objects on* the page rather than controls in it.
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
 * How tall a control is drawn, as distinct from how large it is to touch.
 *
 * The reference's numbers: a button is 52 and a field is 54, the field a hair
 * taller because it holds a line you type rather than a word you tap. `medium`
 * is every action button and clears both platforms' floors on its own; `small`
 * is drawn shorter and reaches `TapTarget` through `hitSlop`, which is what
 * lets a row of filter pills stay light without a thumb missing them; `large`
 * is for the one action a screen exists for.
 *
 * `small` is the reference's chip, 32 (Material's filter chip, which SimpMusic
 * draws its Home, Library and Search filters with). It was 36.
 */
export const ControlHeight = {
  small: 32,
  medium: 52,
  field: 54,
  large: 60,
} as const;

/**
 * The touch slop that lifts a `ControlHeight.small` control to the platform
 * floor: 6 on iOS, 8 on Android. Vertical only — horizontally the label is
 * already wider than the floor.
 */
export const SmallControlSlop = {
  top: (TapTarget - ControlHeight.small) / 2,
  bottom: (TapTarget - ControlHeight.small) / 2,
} as const;

/**
 * The vertical gap between wrapped rows of small controls: exactly the two
 * slops that meet across it (12 on iOS, 16 on Android).
 *
 * Slop expands the touch rectangle without moving the box, and React Native
 * resolves an *overlap* by view order rather than by proximity — so with a
 * smaller gap, a tap between two rows of filter pills would land on whichever
 * pill mounted later. At this gap the touch rectangles tile the row edge to
 * edge and never overlap. Use it as `rowGap` on any wrapping row of
 * `ControlHeight.small` controls; the column gap is free, because the slop is
 * vertical only.
 */
export const SmallControlRowGap = TapTarget - ControlHeight.small;

/**
 * What the floating back disc takes off the top of a screen, above the
 * safe-area inset.
 *
 * 60 on both platforms: the disc is 48 and sits 12 under the inset, which is
 * where SimpMusic's album screen puts its glass back button. It was 56 — an
 * 8dp gap over a 48dp disc on Android — until the disc moved to the
 * reference's corner; a screen that reserves this (`<Screen insetHeader>`)
 * starts where the disc ends.
 *
 * Read it through `useHeaderHeight()`, which adds the inset. Lives here rather
 * than in `<FrostedTopBar>` so the hook and the component can both have it
 * without importing each other; `frosted-top-bar.test.ts` holds the two to the
 * same sum.
 */
export const TopBarHeight = 60;

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

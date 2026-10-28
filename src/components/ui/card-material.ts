import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';

import { Elevation, Palette, Radius, Spacing, type AccentRoles } from '@/constants/theme';
import { AccentInks, useAccent } from '@/hooks/use-accent';
import { useScreenChrome } from '@/hooks/use-screen-chrome';
import { ThemeInks, useTheme } from '@/hooks/use-theme';
import { mix, withAlpha } from '@/lib/color';
import { filledInks, filledRoles, type FilledInks } from '@/lib/filled';

/**
 * The review card's material, which every card in the app is made of.
 *
 * The owner's direction (2026-10-20): "make all the cards in the app with that
 * style of the review ones, with the same size and corner ratio and stuff.
 * Even the ones in the game page." The review card is `<LogCard>`: a flat
 * fill one step above the page, `Radius.review`'s corner, a 1dp hairline in
 * `border`, the card shadow, fifteen in and twelve between its parts. Those
 * five are here, once, and every card reads them — `<Card>`, the game page's
 * section cards (`<SectionCard>`, `<InfoCard>`), its titled cards
 * (`<Panel>`), the member's review card, the critics' card, the notices and
 * blocks screens draw for themselves.
 *
 * ## The fill follows the page
 *
 * On the app's own pages a card is `surface` — the owner's `#1B1F28` on their
 * `#14171C`. On an Apple Music adaptive page (game, studio, collection),
 * cards start in `dark` at rest against the `bright` page background, and
 * smoothly brighten to `bright` as the user scrolls and the page darkens to `dark`.
 *
 * Switch game colours off (Settings → Game colours) and a game's page is the
 * app's own room, so its cards are `surface` too.
 *
 * `border` is white at 7%, so the one edge reads on either fill.
 *
 * ## The filled colour, on a page coloured from its art
 *
 * On the pages whose colour is their artwork's — a game, a studio, a
 * collection (`<Screen artColoured>`) — a card is **exactly the review
 * button's colour**: `filledRoles(accent).fill`, the same value the button and
 * the selected tab paint (the owner's, 2026-10-27: "they have to be EXACTLY
 * the same as the review button and tab color. The exact same one"). It takes
 * the button's ink with it (`filledInks`), handed to everything inside by
 * `<CardInks>` — the theme's type, the accent's type roles and the grey
 * action pill — because the page's own white would not read on it. The card
 * was glass for a few builds; that is gone.
 */
export type CardMaterial = {
  /** The card's fill. */
  fill: string;
  /** Its 1dp hairline. */
  edge: string;
  /** The corner, the edge's width and the shadow — spread it where `cardShape` was. */
  shape: ViewStyle;
  /** A rule inside the card, between its parts, when the card's own is not the default. */
  rule?: string;
  /** The colour the card is seen as, opaque — for a fade that ends on it. */
  solid: string;
  /**
   * The inks written on it, when they are not the page's: a card in the filled
   * colour's. `<CardInks>` hands them down.
   */
  inks: FilledInks | null;
  /**
   * Whether there is no card at all (`<BareCards>`): the content stands on the
   * page. Its fill and edge are transparent and its shape has no corner, edge
   * or shadow; `strip` takes its inset away.
   */
  bare: boolean;
  /**
   * Spread last on a card's own style when it is bare: no padding, so the
   * content stands where the card stood, at the section's inset. Null for a card.
   */
  strip: ViewStyle | null;
};

/**
 * No cards under this — the game page's, at the owner's direction
 * (2026-10-28): "I want you to remove the cards from the game page and leave
 * the information as standalone text floating in the background… remove the
 * information being contained inside a card and leave it as plain text in the
 * background." Every card the page draws reads its material here, so one
 * provider takes them all off: a section's heading stands on the page and its
 * content under it, at the same inset, in the page's own inks.
 */
const Bare = createContext(false);

export function BareCards({ children }: { children: ReactNode }) {
  return createElement(Bare.Provider, { value: true }, children);
}

/** Whether cards are drawn bare here (`<BareCards>`). */
export function useBareCards(): boolean {
  return useContext(Bare);
}

const BARE_STRIP: ViewStyle = {
  padding: 0,
  paddingHorizontal: 0,
  paddingVertical: 0,
  paddingTop: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  paddingRight: 0,
};

const bareShape: ViewStyle = { borderRadius: 0, borderWidth: 0 };

export function useCardMaterial(): CardMaterial {
  const theme = useTheme();
  const chrome = useScreenChrome();
  const accent = useAccent();
  const bare = useBareCards();

  const artColoured = chrome?.artColoured ?? false;
  const bright = chrome?.tone?.bright ?? null;
  const dark = chrome?.tone?.dark ?? null;
  const page = chrome?.background ?? theme.background;

  return useMemo(() => {
    if (bare) {
      return {
        fill: 'transparent',
        edge: 'transparent',
        shape: bareShape,
        rule: theme.border,
        solid: page,
        inks: null,
        bare: true,
        strip: BARE_STRIP,
      };
    }
    if (artColoured) return filledMaterial(accent);
    if (bright) {
      return {
        fill: bright,
        edge: 'rgba(255, 255, 255, 0.1)',
        shape: cardShape,
        solid: bright,
        inks: null,
        bare: false,
        strip: null,
      };
    }
    if (dark) {
      return {
        fill: dark,
        edge: theme.border,
        shape: cardShape,
        solid: dark,
        inks: null,
        bare: false,
        strip: null,
      };
    }
    return cardMaterialFor(accent, theme);
  }, [bare, page, artColoured, bright, dark, accent, theme]);
}

const filledCache = new WeakMap<AccentRoles, CardMaterial>();

/**
 * A card in the filled colour — the review button's, to the value — with its
 * ink and no visible edge (the edge is the fill, as the button's is). One
 * object per accent.
 */
export function filledMaterial(accent: AccentRoles): CardMaterial {
  let material = filledCache.get(accent);
  if (!material) {
    const { fill, ink } = filledRoles(accent);
    const inks = filledInks(fill, ink);
    material = {
      fill,
      edge: fill,
      shape: cardShape,
      rule: inks.rule,
      solid: fill,
      inks,
      bare: false,
      strip: null,
    };
    filledCache.set(accent, material);
  }
  return material;
}

/**
 * Hands a card's inks to everything inside it — the theme's type
 * (`ThemeInks`), the accent's type roles (`AccentInks`) and the grey action
 * pill — when they are not the page's. Nothing at all otherwise.
 */
export function CardInks({ material, children }: { material: CardMaterial; children: ReactNode }) {
  const inks = material.inks;
  if (!inks) return children;
  return createElement(
    ThemeInks,
    {
      inks: {
        text: inks.text,
        secondary: inks.secondary,
        rule: inks.rule,
        control: { fill: withAlpha(inks.text, 0.12), ink: inks.text },
      },
    },
    createElement(AccentInks, { ink: inks.text, quiet: inks.secondary }, children)
  );
}

/**
 * The same, from an accent or key tone in hand — for screens that render
 * cards before context is mounted.
 */
export function cardMaterialFor(
  accent:
    | AccentRoles
    | { bright: string | null; dark: string | null; primary?: string | null }
    | null
    | undefined,
  theme: { surface: string; border: string }
): CardMaterial {
  if (accent && 'bright' in accent && accent.bright) {
    const fill = accent.bright;
    return {
      fill,
      edge: 'rgba(255, 255, 255, 0.1)',
      shape: cardShape,
      solid: fill,
      inks: null,
      bare: false,
      strip: null,
    };
  }
  if (accent && 'dark' in accent) {
    const fill = accent.dark ?? theme.surface;
    return {
      fill,
      edge: theme.border,
      shape: cardShape,
      solid: fill,
      inks: null,
      bare: false,
      strip: null,
    };
  }
  const roles = accent as AccentRoles | null | undefined;
  const fill = roles?.tonal
    ? mix(roles.m3.primaryContainer, Palette.shadowInk, 0.5)
    : theme.surface;
  return {
    fill,
    edge: theme.border,
    shape: cardShape,
    solid: fill,
    inks: null,
    bare: false,
    strip: null,
  };
}

/** Fifteen in — the reference's card inset, and the page margin. */
export const CARD_INSET = Spacing.x16;

/** Twelve between the blocks inside a card, as the review card stacks its three. */
export const CARD_GAP = Spacing.x12;

/**
 * The shape without the fill: the corner, the edge's width and the shadow.
 * Spread it and add `{ backgroundColor: fill, borderColor: edge }`.
 *
 * The shadow is on the same view as the fill: Android clips `elevation` with
 * `overflow: 'hidden'`, so a card that must clip its contents (art to its
 * corner) clips on an inner view, as `<Card>` does.
 */
export const cardShape = StyleSheet.create({
  shape: {
    borderRadius: Radius.review,
    borderWidth: 1,
    ...Elevation.card,
  },
}).shape;

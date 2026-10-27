import { useMemo } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';

import { Elevation, Palette, Radius, Spacing, type AccentRoles } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useScreenChrome } from '@/hooks/use-screen-chrome';
import { useTheme } from '@/hooks/use-theme';
import { mix } from '@/lib/color';
import { GLASS } from '@/lib/page-color';

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
 * ## Glass, on a game's page
 *
 * The owner's brief of 2026-10-27: on a game's page — one flat colour, the
 * hero's (`lib/page-color`) — every card is a pane of glass. White at 12%
 * for the body, so the page shows through and is lifted; a 1dp edge at 30%,
 * brighter than the body, for the bevel; a 1dp highlight inside the top edge,
 * the brightest thing on it; and a large soft shadow, so it floats. Brightest
 * to darkest is what reads as glass (`GLASS`, tested). A page asks for it with
 * `<Screen glass>`; the game page is the one that does.
 *
 * The shadow and the highlight are `boxShadow`, not `Elevation.card`: an
 * Android elevation is drawn under the whole card and shows through a
 * translucent one, where React Native's box shadow clips itself out of the
 * card's own box (`OutsetBoxShadowDrawable`, `clipOutPath`).
 */
export type CardMaterial = {
  /** The card's fill. */
  fill: string;
  /** Its 1dp hairline. */
  edge: string;
  /**
   * The corner, the edge's width and the shadow — spread it where `cardShape`
   * was. Glass's own on a glass page.
   */
  shape: ViewStyle;
  /** A rule inside the card, between its parts, when the card's own is not the default. */
  rule?: string;
  /**
   * The colour the card is seen as, opaque — for a fade that ends on it. The
   * fill itself on a solid card; on glass, the page with its 12% of white.
   */
  solid: string;
  /** Whether this is the glass. */
  glass: boolean;
};

export function useCardMaterial(): CardMaterial {
  const theme = useTheme();
  const chrome = useScreenChrome();
  const accent = useAccent();

  const glass = chrome?.glass ?? false;
  const page = chrome?.background ?? theme.background;
  const bright = chrome?.tone?.bright ?? null;
  const dark = chrome?.tone?.dark ?? null;

  return useMemo(() => {
    if (glass) return glassMaterial(page);
    if (bright) {
      return {
        fill: bright,
        edge: 'rgba(255, 255, 255, 0.1)',
        shape: cardShape,
        solid: bright,
        glass: false,
      };
    }
    if (dark)
      return { fill: dark, edge: theme.border, shape: cardShape, solid: dark, glass: false };
    return cardMaterialFor(accent, theme);
  }, [glass, page, bright, dark, accent, theme]);
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
    return { fill, edge: 'rgba(255, 255, 255, 0.1)', shape: cardShape, solid: fill, glass: false };
  }
  if (accent && 'dark' in accent) {
    const fill = accent.dark ?? theme.surface;
    return { fill, edge: theme.border, shape: cardShape, solid: fill, glass: false };
  }
  const roles = accent as AccentRoles | null | undefined;
  const fill = roles?.tonal
    ? mix(roles.m3.primaryContainer, Palette.shadowInk, 0.5)
    : theme.surface;
  return { fill, edge: theme.border, shape: cardShape, solid: fill, glass: false };
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
const shapes = StyleSheet.create({
  card: {
    borderRadius: Radius.review,
    borderWidth: 1,
    ...Elevation.card,
  },
  glass: {
    borderRadius: Radius.review,
    borderWidth: 1,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: GLASS.shadowOffset,
        blurRadius: GLASS.shadowBlur,
        color: GLASS.shadow,
      },
      /* The light on the bevel: one dp inside the top edge. */
      { inset: true, offsetX: 0, offsetY: 1, blurRadius: 0, color: GLASS.highlight },
    ],
  },
});

export const cardShape = shapes.card;

const glassCache = new Map<string, CardMaterial>();

/**
 * The glass card on `page` — `useCardMaterial`'s on a glass page, and for a
 * screen that draws a card before its own `<Screen>`'s context exists (the
 * game page's own log, in its masthead). One object per page colour.
 */
export function glassMaterial(page: string): CardMaterial {
  let material = glassCache.get(page);
  if (!material) {
    material = {
      fill: GLASS.fill,
      edge: GLASS.edge,
      shape: shapes.glass,
      rule: 'rgba(255, 255, 255, 0.12)',
      /* The renderer composites in sRGB, as `mix` does. */
      solid: mix(page, '#FFFFFF', GLASS.fillAlpha),
      glass: true,
    };
    glassCache.set(page, material);
  }
  return material;
}

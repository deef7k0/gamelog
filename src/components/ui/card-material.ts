import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { interpolateColor, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { Elevation, Palette, Radius, Spacing, type AccentRoles } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { usePulse } from '@/hooks/use-pulse';
import { useScreenChrome } from '@/hooks/use-screen-chrome';
import { useTheme } from '@/hooks/use-theme';
import { mix } from '@/lib/color';

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
 */
export type CardMaterial = {
  /** The card's fill. */
  fill: string;
  /** Its 1dp hairline. */
  edge: string;
};

export function useCardMaterial(): CardMaterial {
  const theme = useTheme();
  const chrome = useScreenChrome();
  const accent = useAccent();

  return useMemo(() => {
    if (chrome?.tone?.dark) {
      return {
        fill: chrome.tone.dark,
        edge: theme.border,
      };
    }
    return cardMaterialFor(accent, theme);
  }, [chrome?.tone?.dark, accent, theme]);
}

/**
 * UI-thread animated style for cards on an adaptive keyColor screen.
 * Inverts with the scroll: at rest (scrollY = 0) it is the `dark` tone against
 * the `bright` background; as the user scrolls, it brightens to `bright` as the
 * background darkens to `dark`.
 */
export function useCardAnimatedStyle() {
  const chrome = useScreenChrome();
  const still = useSharedValue(0);
  const darkening = chrome?.tone?.darkening ?? still;
  const dark = chrome?.tone?.dark;
  const bright = chrome?.tone?.bright;
  const pulse = usePulse();

  return useAnimatedStyle(() => {
    pulse.get();
    if (!dark || !bright) return {};
    return {
      backgroundColor: interpolateColor(darkening.get(), [0, 1], [dark, bright]),
    };
  });
}

/**
 * The same, from an accent or key tone in hand — for screens that render
 * cards before context is mounted.
 */
export function cardMaterialFor(
  accent: AccentRoles | { bright: string | null; dark: string | null } | null | undefined,
  theme: { surface: string; border: string }
): CardMaterial {
  if (accent && 'dark' in accent) {
    return {
      fill: accent.dark ?? theme.surface,
      edge: theme.border,
    };
  }
  const roles = accent as AccentRoles | null | undefined;
  return {
    fill: roles?.tonal ? mix(roles.m3.primaryContainer, Palette.shadowInk, 0.5) : theme.surface,
    edge: theme.border,
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

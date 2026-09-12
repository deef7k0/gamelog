import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { PLATFORMS, type PlatformKey } from '@/constants/platform-cases';
import { Radius, Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { getGameStores } from '@/lib/games/igdb';
import {
  formatPrice,
  getBestPriceForPlatform,
  getStorePrices,
  lookupItadGame,
} from '@/lib/games/itad';
import { parseGameId } from '@/lib/games';

/** IGDB's `external_games.category` for Steam. */
const STEAM_CATEGORY = 1;

export type GamePriceProps = {
  /** App-wide game id. */
  gameId: string;
  /** Active platform family (ps5, xbox, pc, switch, etc.). */
  selected: PlatformKey;
  /** Game title for ITAD fallback lookup. */
  title?: string;
  /** Direct Steam App ID from game metadata if known. */
  steamAppId?: string | null;
};

/**
 * Where a game can be bought, split into two pieces the game page places
 * separately: the price sits high in the info column, the platform buttons sit
 * under it.
 *
 * They are one control between them. The page owns the selection, so picking
 * PS5 swaps the case *and* the price together. It no longer swaps a store link:
 * buying moved to Overview's "Where to buy", which lists every storefront rather
 * than sending the reader to one.
 *
 * Uses IsThereAnyDeal across ~40 storefronts to find the best available price
 * for the selected platform (PC storefronts for PC, PlayStation Store for PS5/PS4,
 * Microsoft Store for Xbox, Nintendo eShop for Switch).
 */
export function GamePrice({
  gameId,
  selected,
  title,
  steamAppId: directSteamAppId,
}: GamePriceProps) {
  const theme = useTheme();
  /* `quietInk` rather than a grey token, throughout. On a tonal accent it
     resolves to M3's `onSurfaceVariant` — the neutral-variant palette at tone
     80, which carries a trace of the seed's hue rather than being a flat grey.
     That is the role M3 has for secondary type, and it belongs to the page in a
     way `textSecondary` does not. */
  const accent = useAccent();
  const parsed = parseGameId(gameId);
  const igdbId = parsed?.source === 'igdb' ? parsed.sourceId : null;
  const knownSteamAppId = parsed?.source === 'steam' ? parsed.sourceId : (directSteamAppId ?? null);

  const stores = useQuery({
    queryKey: ['game-stores', gameId],
    queryFn: ({ signal }) => getGameStores(igdbId!, signal),
    enabled: !!igdbId && !knownSteamAppId,
    staleTime: 30 * 60_000,
  });

  const meta = PLATFORMS[selected];

  const steamAppId =
    knownSteamAppId ??
    (stores.data ?? []).find((entry) => entry.category === STEAM_CATEGORY)?.uid ??
    null;

  const itadId = useQuery({
    queryKey: ['itad-id', gameId, steamAppId, title],
    queryFn: ({ signal }) => lookupItadGame({ steamAppId, title: title ?? null }, signal),
    enabled: !!knownSteamAppId || !igdbId || stores.isSuccess,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  const prices = useQuery({
    queryKey: ['itad-prices', itadId.data],
    queryFn: ({ signal }) => getStorePrices(itadId.data!, signal),
    enabled: !!itadId.data,
    staleTime: 15 * 60_000,
    retry: false,
  });

  const deal = getBestPriceForPlatform(prices.data, selected);
  const isLoading = (itadId.isLoading || prices.isLoading) && !deal;

  return (
    <View style={styles.price}>
      <View style={styles.priceLine}>
        <Ionicons name={meta.icon} size={16} color={meta.accent} />

        {deal ? (
          <>
            <Text variant="h3">{formatPrice(deal.amount, deal.currency)}</Text>
            {deal.cut > 0 && (
              <Text
                variant="caption"
                style={StyleSheet.flatten([styles.struck, { color: accent.quietInk }])}>
                {formatPrice(deal.regular, deal.currency)}
              </Text>
            )}
            {/* Opaque fills, not a 15% wash of their own hue.

                An alpha badge over the old ambient gradient had no fixed
                background — its contrast was whatever the gradient happened to
                be under it, which measured 3.77:1 (discount) and 3.95:1
                (all-time low) at the top of the page. A solid `surface` behind
                them is a known quantity and puts both at ~10:1.
                
                `label`, not `caption` + `fontWeight: '700'`. That weight was a
                no-op: React Native will not synthesise bold from a custom font
                on Android, so the one emphatic element in this row rendered
                regular on half the devices that shipped it. `Type.label` is a
                separately loaded Medium family and carries its weight for real. */}
            {deal.cut > 0 && (
              <View style={[styles.discount, { backgroundColor: theme.surface }]}>
                <Text variant="label" style={{ color: theme.success }}>
                  −{deal.cut}%
                </Text>
              </View>
            )}
            {deal.isAllTimeLow && (
              <View style={[styles.discount, { backgroundColor: theme.surface }]}>
                <Text variant="label" style={{ color: theme.identityGold }}>
                  LOWEST
                </Text>
              </View>
            )}
          </>
        ) : (
          <Text variant="h5" style={{ color: accent.quietInk }}>
            {isLoading ? 'Checking prices…' : 'Price on the store'}
          </Text>
        )}
      </View>

      {/*
        No outbound link here any more.

        This used to carry an "Open on Steam" row under the price. It was the
        masthead — the block that answers *what is this game* — quietly turning
        into a storefront, and it duplicated a control that already exists and
        does the job better: Overview's "Where to buy" lists every storefront
        ITAD tracks with its own price beside it, so the reader picks a shop
        rather than being sent to whichever one happened to be cheapest.

        The price stays, because a price is a fact about the game. Buying is an
        action, and actions on this page live under the tabs.
      */}
    </View>
  );
}

export type PlatformPickerProps = {
  /** Every platform the game is on, in priority order. */
  available: PlatformKey[];
  selected: PlatformKey;
  onSelect: (platform: PlatformKey) => void;
};

/** How many platform pills stand before the row offers to count instead. */
const VISIBLE_PLATFORMS = 3;

/**
 * The platform buttons. Changes the artwork and the price together.
 *
 * ## Three, then a count
 *
 * A seven-platform title used to render seven pills, which wrapped to three rows
 * inside the masthead's column — its own style note admitted as much — and put
 * roughly 100dp of chrome between the case and the first thing anyone reads. The
 * row now stands at three and offers "4 more…", which expands in place.
 *
 * **The selected platform is always among the visible three**, even when it
 * ranks below them: this control re-draws the case and the price together, so a
 * collapsed row that hid the active choice would leave the page showing PS5
 * artwork with no lit pill to explain why. When the selection falls
 * outside the first three it takes the third slot and the pill it displaces goes
 * into the overflow — the count stays honest either way.
 */
export function PlatformPicker({ available, selected, onSelect }: PlatformPickerProps) {
  const accent = useAccent();
  const [expanded, setExpanded] = useState(false);

  if (available.length < 2) return null;

  /* Priority order, except that the selection is never allowed to fall out of
     view — it is swapped into the last visible slot when it would have. */
  const head = available.slice(0, VISIBLE_PLATFORMS);
  const visible =
    expanded || head.includes(selected)
      ? head
      : [...head.slice(0, VISIBLE_PLATFORMS - 1), selected];

  const shown = expanded ? available : visible;
  const hidden = available.length - shown.length;

  return (
    <View style={styles.platforms}>
      {shown.map((key) => {
        const platform = PLATFORMS[key];
        const isActive = key === selected;
        return (
          <PressableScale
            key={key}
            accessibilityRole="button"
            accessibilityLabel={`Show ${platform.label}`}
            accessibilityState={{ selected: isActive }}
            hitSlop={{ top: 8, bottom: 8 }}
            onPress={() => onSelect(key)}
            scaleTo={0.92}
            style={StyleSheet.flatten([
              styles.platform,
              {
                /*
                 * The same tonal key the action row below uses, and that is the
                 * point: these two rows are the masthead's only controls, and
                 * the platforms used to be outlined capsules floating on the
                 * gradient while the actions were filled keys. Two shapes, two
                 * fills, one job each. Now both sit *into* the page on
                 * `accent.elevated` — a surface step carrying the game's hue at
                 * its own luminance, so it reads as recessed rather than as a
                 * lighter panel. The content cards in Overview go the other way
                 * (`accent.card`, lighter, more hue) because a panel you read
                 * should lift and a control you press should sink.
                 */
                backgroundColor: isActive
                  ? accent.m3.primaryContainer
                  : accent.m3.surfaceContainerHigh,
                borderColor: isActive ? accent.m3.primaryContainer : accent.m3.surfaceContainerHigh,
              },
            ])}>
            {/*
              The lit key wears the **game's** own colour, not the platform's
              brand hue.

              That is a reversal, and it is the right one on a page whose whole
              palette is now one hue at five tones. The brand colour was
              defensible while the page was grey-and-gradient — the mark was the
              datum, and its own colour said which platform. It is not defensible
              here: this is the masthead, the masthead has exactly one loud tone,
              and an Xbox-green key beside an amber review button is a second
              accent competing with the one the page is built from. Which
              platform is selected is already carried by the fill *existing* and
              by the label, which is two carriers without borrowing a third hue.

              The glyph and label go to `onPrimaryContainer`, which M3 derives
              for exactly this pairing — so they clear on a bright amber and on a
              deep indigo alike, and the test asserts that across every seed.
            */}
            <Ionicons
              name={platform.icon}
              size={16}
              color={isActive ? accent.m3.onPrimaryContainer : accent.m3.onSurfaceVariant}
            />
            <Text
              variant="bodySmall"
              style={{
                color: isActive ? accent.m3.onPrimaryContainer : accent.m3.onSurfaceVariant,
              }}>
              {platform.short}
            </Text>
          </PressableScale>
        );
      })}

      {/* The overflow is a pill in the same row and the same shape as the
          platforms it stands for, because it is one more thing you can press in
          that row — not a link under it. It carries no platform mark, which is
          what keeps it from reading as a platform called "4 more". */}
      {(hidden > 0 || expanded) && (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={
            expanded
              ? 'Show fewer platforms'
              : `Show ${hidden} more platform${hidden === 1 ? '' : 's'}`
          }
          accessibilityState={{ expanded }}
          hitSlop={{ top: 8, bottom: 8 }}
          onPress={() => setExpanded((open) => !open)}
          scaleTo={0.92}
          style={StyleSheet.flatten([
            styles.platform,
            {
              backgroundColor: accent.m3.surfaceContainerHigh,
              borderColor: accent.m3.surfaceContainerHigh,
            },
          ])}>
          <Text variant="bodySmall" style={{ color: accent.quietInk }}>
            {expanded ? 'Show less' : `${hidden} more…`}
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={accent.quietInk}
          />
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  price: { gap: Spacing.x4 },
  /* `x8`, down from `x12`. The keys are filled now rather than outlined, so the
     row reads as a set at a tighter interval — and the extra width each key
     gained had to come from somewhere or four of them stop fitting across a
     390dp display, which is the symmetry the row depends on. */
  platforms: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.x8 },
  platform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x4 + 2,
    /* A rounded square, not the app's control radius and not a pill. `Radius.lg`
       is the same corner the game page's inner action keys take (`GROUP_SEAM`),
       which is what makes the two rows read as the same family of object — and
       they now share a fill vocabulary too (`primaryContainer` lit,
       `surfaceContainerHigh` unlit). */
    minHeight: 44,
    /* `minHeight` above carries the tap floor on its own now, so the padding is
       free to be about the shape rather than about reaching 44. It used to lean
       on `hitSlop` for the last dp — the note here worked the arithmetic twice
       and got it wrong once — and a key that *is* 44 needs none of that.

       A little bigger than before, as asked, and capped there: four of these
       have to sit across a 390dp display without wrapping, which is what keeps
       the row symmetrical. At `x12` horizontal the four widest labels come to
       roughly 356dp including gaps, which fits; at `x16` they do not. */
    paddingVertical: Spacing.x8,
    paddingHorizontal: Spacing.x12,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  priceLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8, flexWrap: 'wrap' },
  struck: { textDecorationLine: 'line-through' },
  discount: {
    paddingHorizontal: Spacing.x8,
    paddingVertical: 1,
    borderRadius: Radius.image,
  },
});

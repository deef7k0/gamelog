import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { type PlatformKey } from '@/constants/platform-cases';
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
 * What a game costs on one platform, under the platform button in Overview's
 * Platforms section (`<GamePlatforms>`).
 *
 * The page owns the selection, so picking PS5 swaps the case *and* the price
 * together. It sat in the masthead for a long time, following a platform you
 * picked by holding the case; with the choice made further down the page, a
 * price at the top would change out of sight, so it moved to sit under the
 * control that changes it. It carries no platform glyph of its own: the button
 * directly above it already does. It no longer swaps a store link either:
 * buying is Overview's "Where to buy", which lists every storefront rather than
 * sending the reader to one.
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
        {deal ? (
          <>
            {/* `h4`, a step under the title above it in the same column. */}
            <Text variant="h4">{formatPrice(deal.amount, deal.currency)}</Text>
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

const styles = StyleSheet.create({
  price: { gap: Spacing.x4 },
  priceLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8, flexWrap: 'wrap' },
  struck: { textDecorationLine: 'line-through' },
  discount: {
    paddingHorizontal: Spacing.x8,
    paddingVertical: 1,
    borderRadius: Radius.image,
  },
});

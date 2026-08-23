import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Linking, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { PLATFORMS, type PlatformKey } from '@/constants/platform-cases';
import { Radius, Spacing, TapTarget, withAlpha } from '@/constants/theme';
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
 * PS5 swaps the case *and* the price *and* the store link together.
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
  /* This renders into the game page's masthead, which sits on the brightest
     part of `<ScrollAmbience>` — luminance 0.11, where every grey token in
     the palette collapses (`textMuted` measures 1.66:1 there, `textSecondary`
     2.76:1). `quietInk` is the accent system's answer: near-white carrying
     the page's own hue, ≥4.66:1 on that stop for every accent the app can
     produce. Both components below are rendered only by `game/[id]`, so this
     is the only backdrop they ever have. */
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
  const platformStoreLink =
    meta.externalCategory === null
      ? null
      : (stores.data ?? []).find((entry) => entry.category === meta.externalCategory);

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
  const storeUrl = deal?.url ?? platformStoreLink?.url ?? null;
  const storeLabel = deal
    ? `Open on ${deal.shopName}`
    : platformStoreLink?.url
      ? meta.storeLabel
      : null;

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
                
                An alpha badge over `<ScrollAmbience>` has no fixed background —
                its contrast is whatever the gradient happens to be under it,
                which measured 3.77:1 (discount) and 3.95:1 (all-time low) at
                the top of the page. A solid `surface` behind them is a known
                quantity and puts both at ~10:1.
                
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

      {/* Outbound store link */}
      {storeUrl && storeLabel && (
        <PressableScale
          accessibilityRole="link"
          accessibilityLabel={storeLabel}
          onPress={() => {
            Linking.openURL(storeUrl).catch(() => {
              // No handler for the scheme; nothing useful to say about it.
            });
          }}
          scaleTo={0.98}
          style={styles.storeLink}>
          <Text variant="bodySmall" style={{ color: accent.quietInk }}>
            {storeLabel}
          </Text>
          <Ionicons name="open-outline" size={13} color={theme.text} />
        </PressableScale>
      )}
    </View>
  );
}

export type PlatformPickerProps = {
  /** Every platform the game is on, in priority order. */
  available: PlatformKey[];
  selected: PlatformKey;
  onSelect: (platform: PlatformKey) => void;
};

/** The platform buttons. Changes the artwork, the price and the store link at once. */
export function PlatformPicker({ available, selected, onSelect }: PlatformPickerProps) {
  const theme = useTheme();
  const accent = useAccent();
  if (available.length < 2) return null;

  return (
    <View style={styles.platforms}>
      {available.map((key) => {
        const platform = PLATFORMS[key];
        const isActive = key === selected;
        return (
          <PressableScale
            key={key}
            accessibilityRole="button"
            accessibilityLabel={`Show ${platform.label}`}
            accessibilityState={{ selected: isActive }}
            hitSlop={{ top: 7, bottom: 7 }}
            onPress={() => onSelect(key)}
            scaleTo={0.92}
            style={StyleSheet.flatten([
              styles.platform,
              {
                backgroundColor: isActive ? withAlpha(platform.accent, 0.14) : 'transparent',
                borderColor: isActive ? withAlpha(platform.accent, 0.5) : theme.border,
              },
            ])}>
            <Ionicons
              name={platform.icon}
              size={13}
              color={isActive ? platform.accent : accent.quietInk}
            />
            <Text variant="caption" style={{ color: isActive ? theme.text : accent.quietInk }}>
              {platform.short}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  price: { gap: Spacing.x4 },
  /* The gap grew with the pills. These wrap to three rows on a seven-platform
     title, and the `hitSlop` below extends each pill's target vertically — at
     the old 6dp gap two rows of hit area would have overlapped by more than
     they cleared, which trades one missed tap for another. */
  platforms: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.x12 },
  platform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x4 + 1,
    /* 25dp before, on the control that re-drives the case artwork, the price
       and the store link at once — the page's signature interaction, on the
       second-smallest target it had. Padding takes the box to 35 and the
       `hitSlop` carries it to 49, past both platform floors. Deliberately not
       taken to 44 on padding alone: seven of these wrap to three rows inside a
       199dp column, and a 47dp-tall pill would add ~66dp to a masthead that is
       already the tallest thing on the page. */
    paddingVertical: Spacing.x12,
    paddingHorizontal: Spacing.x8,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  priceLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8, flexWrap: 'wrap' },
  struck: { textDecorationLine: 'line-through' },
  discount: {
    paddingHorizontal: Spacing.x8,
    paddingVertical: 1,
    borderRadius: Radius.image,
  },
  /* 16dp tall before — the shortest control on the page, and an outbound
     commerce link. `alignSelf: 'flex-start'` keeps the box hugging the label
     rather than spanning the column, so the target grows downward without the
     link looking like a full-width row. */
  storeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.x4,
    minHeight: TapTarget,
    paddingRight: Spacing.x8,
  },
});

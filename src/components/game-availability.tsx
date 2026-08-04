import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Linking, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { PLATFORMS, type PlatformKey } from '@/constants/platform-cases';
import { Radius, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getGameStores } from '@/lib/games/igdb';
import { fetchSteamPrice } from '@/lib/games/steam';
import { parseGameId } from '@/lib/games';

/** IGDB's `external_games.category` for Steam — the one store that quotes a price. */
const STEAM_CATEGORY = 1;

/**
 * Where a game can be bought, split into two pieces the game page places
 * separately: the price sits high in the info column, the platform buttons sit
 * under it.
 *
 * They are one control between them. The page owns the selection, so picking
 * PS5 swaps the case *and* the price *and* the store link together — two
 * switchers for one choice would be two ways to disagree.
 *
 * **Only Steam quotes a real price.** IGDB publishes no pricing at all, and
 * PlayStation, Microsoft, Nintendo, Apple and Google have no public price API,
 * so every non-PC platform shows its mark and its store link with no number.
 * That is the honest shape of the data — inventing a price, or showing one
 * platform's price under another's logo, would be worse than the gap.
 */
export function GamePrice({ gameId, selected }: { gameId: string; selected: PlatformKey }) {
  const theme = useTheme();
  const parsed = parseGameId(gameId);
  const igdbId = parsed?.source === 'igdb' ? parsed.sourceId : null;

  const stores = useQuery({
    queryKey: ['game-stores', gameId],
    queryFn: ({ signal }) => getGameStores(igdbId!, signal),
    enabled: !!igdbId,
    staleTime: 30 * 60_000,
  });

  const meta = PLATFORMS[selected];
  const link =
    meta.externalCategory === null
      ? null
      : (stores.data ?? []).find((entry) => entry.category === meta.externalCategory);

  const steamAppId =
    selected === 'pc'
      ? ((stores.data ?? []).find((entry) => entry.category === STEAM_CATEGORY)?.uid ?? null)
      : null;

  const price = useQuery({
    queryKey: ['steam-price', steamAppId],
    queryFn: ({ signal }) => fetchSteamPrice(steamAppId!, signal),
    enabled: !!steamAppId,
    // Prices move; an hour is short enough to be current and long enough to
    // stay clear of Steam's ~200 requests / 5 minutes.
    staleTime: 60 * 60_000,
  });

  const storeUrl = link?.url ?? null;

  return (
    <View style={styles.price}>
      <View style={styles.priceLine}>
        <Ionicons name={meta.icon} size={16} color={meta.accent} />

        {price.data ? (
          <>
            <Text variant="heading">{price.data.formatted}</Text>
            {price.data.wasFormatted && (
              <Text variant="micro" color="textMuted" style={styles.struck}>
                {price.data.wasFormatted}
              </Text>
            )}
            {price.data.discountPercent > 0 && (
              <View style={[styles.discount, { backgroundColor: withAlpha(theme.success, 0.15) }]}>
                <Text variant="micro" style={{ color: theme.success }}>
                  −{price.data.discountPercent}%
                </Text>
              </View>
            )}
          </>
        ) : (
          <Text variant="bodyStrong" color="textSecondary">
            {price.isLoading ? 'Checking price…' : 'Price on the store'}
          </Text>
        )}
      </View>

      {/* The line changes with the platform: "Open in Steam", "Open in the
          App Store", "Open in Google Play". */}
      {storeUrl && (
        <PressableScale
          accessibilityRole="link"
          accessibilityLabel={meta.storeLabel}
          onPress={() => {
            Linking.openURL(storeUrl).catch(() => {
              // No handler for the scheme; nothing useful to say about it.
            });
          }}
          scaleTo={0.98}
          style={styles.storeLink}>
          <Text variant="caption" color="primary">
            {meta.storeLabel}
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
              color={isActive ? platform.accent : theme.textMuted}
            />
            <Text variant="micro" color={isActive ? 'text' : 'textMuted'}>
              {platform.short}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  price: { gap: Spacing.one },
  platforms: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  platform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 1,
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  priceLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  struck: { textDecorationLine: 'line-through' },
  discount: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
    borderRadius: Radius.small,
  },
  storeLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});

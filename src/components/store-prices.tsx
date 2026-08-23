import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { SectionHeader } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { storeBrand, storeInitial } from '@/constants/stores';
import { Radius, Spacing, readableInk } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getGameStores } from '@/lib/games/igdb';
import { formatPrice, getStorePrices, lookupItadGame, type StorePrice } from '@/lib/games/itad';
import { parseGameId } from '@/lib/games';

/** IGDB's `external_games.category` for Steam — the appid ITAD looks up by. */
const STEAM_CATEGORY = 1;

/** The mark's edge length. Fixed dp: it is artwork-adjacent, not chrome. */
const MARK = 34;

export type StorePricesProps = {
  /** App-wide game id. */
  gameId: string;
  /** Falls back to a title lookup when the game has no Steam listing. */
  title: string;
  /** Steam App ID if already known from game metadata. */
  steamAppId?: string | null;
};

/**
 * Where this game is sold and what it costs, as a row of store buttons.
 *
 * Replaces a single Steam number with the question a reader actually has —
 * *where is this cheapest right now* — using IsThereAnyDeal, which aggregates
 * around forty storefronts. The old behaviour was not wrong, it was narrow: it
 * could only ever quote Steam, because Steam is the only storefront with a
 * public price endpoint.
 *
 * ## Two requests, chained
 *
 * ITAD keys on its own uuid, so the game has to be resolved first: Steam appid
 * (from IGDB's `external_games` or steam: ID) if there is one, the title if there is not.
 * The lookup is cached hard — an identity does not change — and the prices are
 * cached briefly, because being current is the entire point.
 */
export function StorePrices({ gameId, title, steamAppId: directSteamAppId }: StorePricesProps) {
  const parsed = parseGameId(gameId);
  const igdbId = parsed?.source === 'igdb' ? parsed.sourceId : null;
  const knownSteamAppId = parsed?.source === 'steam' ? parsed.sourceId : (directSteamAppId ?? null);

  /* Fetched only if we don't already have a steamAppId and have an IGDB id */
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
    queryFn: ({ signal }) => lookupItadGame({ steamAppId, title }, signal),
    // Waits for the store list if needed so the appid path gets its chance
    enabled: !!knownSteamAppId || !igdbId || stores.isSuccess,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  const prices = useQuery({
    queryKey: ['itad-prices', itadId.data],
    queryFn: ({ signal }) => getStorePrices(itadId.data!, signal),
    enabled: !!itadId.data,
    // Short: a sale that ended an hour ago is the one thing this must not show.
    staleTime: 15 * 60_000,
    retry: false,
  });

  const list = prices.data ?? [];
  if (list.length === 0) return null;

  const best = list[0];

  return (
    <View style={styles.section}>
      <SectionHeader
        title="Where to buy"
        action={
          /* The cheapest number, repeated in the heading. The row below is
             horizontally scrollable, so the best price can be off-screen at
             rest — and "from $9.99" is the one fact worth reading without
             scrolling. */
          <Text variant="bodySmall" color="textMuted">
            from {formatPrice(best.amount, best.currency)}
          </Text>
        }
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {list.map((deal) => (
          <StoreButton key={`${deal.shopId}:${deal.url}`} deal={deal} />
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * One storefront: its mark, its name, its price.
 *
 * A button rather than a table row because that is what it does — every one of
 * these opens the store. The discount, when there is one, is the only coloured
 * thing on it: a price cut is *meaning* in the sense the design system allows,
 * and it is the reason someone is scanning this row at all.
 */
function StoreButton({ deal }: { deal: StorePrice }) {
  const theme = useTheme();
  const brand = storeBrand(deal.shopId);
  const ink = readableInk(brand.color);
  const discounted = deal.cut > 0;

  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={
        discounted
          ? `${deal.shopName}, ${formatPrice(deal.amount, deal.currency)}, ${deal.cut} percent off`
          : `${deal.shopName}, ${formatPrice(deal.amount, deal.currency)}`
      }
      onPress={() => {
        Linking.openURL(deal.url).catch(() => {
          // No handler for the scheme, or the link is dead. Nothing useful to
          // say about it on a price button.
        });
      }}
      scaleTo={0.96}
      style={StyleSheet.flatten([
        styles.button,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ])}>
      <View style={[styles.mark, { backgroundColor: brand.color }]}>
        {brand.icon ? (
          <Ionicons name={brand.icon} size={18} color={ink} />
        ) : (
          <Text variant="h5" style={{ color: ink }}>
            {storeInitial(deal.shopName)}
          </Text>
        )}
      </View>

      <View style={styles.labels}>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {deal.shopName}
        </Text>

        <View style={styles.priceLine}>
          <Text variant="h5" numberOfLines={1}>
            {formatPrice(deal.amount, deal.currency)}
          </Text>

          {discounted && (
            <Text variant="caption" color="textMuted" style={styles.struck} numberOfLines={1}>
              {formatPrice(deal.regular, deal.currency)}
            </Text>
          )}
        </View>
      </View>

      {discounted && (
        <View style={styles.cutContainer}>
          {/* Opaque, for the same reason as the masthead's copy of this badge:
              a 15% wash of its own hue has no fixed background on a page lit by
              `<ScrollAmbience>`, so its contrast was whatever the gradient was
              doing underneath. */}
          <View style={[styles.cut, { backgroundColor: theme.surface }]}>
            <Text variant="label" style={{ color: theme.success }}>
              −{deal.cut}%
            </Text>
          </View>
          {deal.isAllTimeLow && (
            <Text variant="label" style={{ color: theme.identityGold }}>
              LOWEST
            </Text>
          )}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.x12 },
  /* Cancels the page's own padding so the row can scroll to both edges — the
     same trick the game rails use. */
  row: { gap: Spacing.x8, paddingRight: Spacing.x16 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    padding: Spacing.x8,
    paddingRight: Spacing.x12,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  mark: {
    width: MARK,
    height: MARK,
    borderRadius: Radius.image,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labels: { gap: 1 },
  priceLine: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.x4 },
  struck: { textDecorationLine: 'line-through' },
  cutContainer: {
    alignItems: 'center',
    gap: 2,
    marginLeft: Spacing.x4,
  },
  cut: {
    paddingHorizontal: Spacing.x8,
    paddingVertical: 1,
    borderRadius: Radius.image,
  },
});

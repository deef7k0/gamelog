import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { InfoCard } from '@/components/ui/info-card';
import { Text } from '@/components/ui/text';
import { OFFICIAL_STORES, storeBrand, storeInitial, type StoreBrand } from '@/constants/stores';
import { Radius, Spacing, TapTarget, readableInk } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useGamePrices } from '@/hooks/use-game-prices';
import { useTheme } from '@/hooks/use-theme';
import { formatPrice, type StorePrice } from '@/lib/games/itad';
import { ITAD_SHOP_OF_STORE, arrangeOffers } from '@/lib/games/storefronts';

/** The mark's edge length. Fixed dp: it is artwork-adjacent, not chrome. */
const MARK = 34;

/**
 * Stores shown while the card is folded — the first three, official stores
 * first, at the owner's direction (2026-10-16): "display 3 stores only, the
 * first ones that appear from the official ones, and then a show all with all
 * the other stores". Unfolded, every store there is.
 */
const FOLDED_STORES = 3;

export type StorePricesProps = {
  /** App-wide game id. */
  gameId: string;
  /** For the price lookup when the game has no Steam listing. */
  title: string;
};

/**
 * Where to buy the game: every official store it is sold at, and what each
 * charges where that is known — then the other shops that sell it.
 *
 * ```text
 *   Where to buy                                  from $9.99
 *   ╭──────────────────────────────────────────────────────╮
 *   │ ▣ Steam                 $49.99                     ↗ │
 *   │ ▣ GOG                   $9.99  $39.99      −75%    ↗ │
 *   │ ▣ PlayStation Store     Price on the store         ↗ │
 *   │ Show all ⌄                                           │
 *   ╰──────────────────────────────────────────────────────╯
 *
 *   …and "Show all" adds the rest of the official stores, then
 *   "Other stores": Humble, Fanatical, … with ITAD's prices.
 * ```
 *
 * ## The owner's rule (2026-10-16)
 *
 * The **official stores, and their links, are IGDB's**: every platform shop
 * IGDB lists the game on is a row, priced or not. **IsThereAnyDeal prices the
 * ones it can** — Steam, GOG, Epic and the Microsoft Store; it tracks no
 * console or phone shop — and **the other shops are ITAD's**, with its links.
 * `arrangeOffers` (`lib/games/storefronts.ts`) is the rule; this draws it.
 *
 * It replaced a list of ITAD's prices alone, cheapest first, which could only
 * ever name PC shops — a PlayStation exclusive had no section at all — and
 * dropped a store with no price.
 */
export function StorePrices({ gameId, title }: StorePricesProps) {
  const accent = useAccent();
  const [open, setOpen] = useState(false);
  const { storefronts, prices, loading } = useGamePrices(gameId, title);

  const { official, others } = arrangeOffers(storefronts.stores, prices);
  if (official.length === 0 && others.length === 0) return null;

  /* The heading's "from": the best price anywhere on the card. */
  const best = [...official.flatMap((row) => (row.price ? [row.price] : [])), ...others].sort(
    (a, b) => a.amount - b.amount
  )[0];

  /* Folded, the first three rows in drawing order — so the official stores
     fill them first, and another shop only shows when there are fewer than
     three of those. */
  const total = official.length + others.length;
  const folds = total > FOLDED_STORES;
  const room = folds && !open ? FOLDED_STORES : total;
  const shownOfficial = official.slice(0, room);
  const shownOthers = others.slice(0, Math.max(0, room - shownOfficial.length));

  return (
    <InfoCard
      title="Where to buy"
      action={
        best ? (
          <Text variant="bodySmall" color="textMuted">
            from {formatPrice(best.amount, best.currency)}
          </Text>
        ) : undefined
      }>
      <View style={styles.list}>
        {shownOfficial.map((row) => {
          const store = OFFICIAL_STORES[row.key];
          /* Whether ITAD could price this store at all: while it is still
             being asked, those rows say so rather than "Price on the store". */
          const priceable = ITAD_SHOP_OF_STORE[row.key] !== undefined;
          return (
            <StoreRow
              key={row.key}
              name={store.name}
              brand={store}
              url={row.url}
              price={row.price}
              pending={loading && priceable && !row.price}
            />
          );
        })}

        {shownOthers.length > 0 && (
          <Text
            variant="caption"
            color="textMuted"
            accessibilityRole="header"
            style={shownOfficial.length > 0 && styles.othersHead}>
            Other stores
          </Text>
        )}

        {shownOthers.map((deal) => (
          <StoreRow
            key={`${deal.shopId}:${deal.url}`}
            name={deal.shopName}
            brand={storeBrand(deal.shopId)}
            url={deal.url}
            price={deal}
            pending={false}
          />
        ))}

        {folds && (
          <PressableScale
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={open ? 'Show fewer stores' : `Show all ${total} stores`}
            onPress={() => setOpen((value) => !value)}
            scaleTo={0.98}
            style={styles.toggle}>
            <Text variant="h5" style={{ color: accent.onSurface }}>
              {open ? 'Show less' : 'Show all'}
            </Text>
            <Ionicons
              name={open ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={accent.onSurface}
            />
          </PressableScale>
        )}
      </View>
    </InfoCard>
  );
}

/**
 * One store: its mark, its name, its price or why there is none — and the way
 * there.
 *
 * A button rather than a table row because that is what it does: every one
 * opens the store, in its own app where the phone has it (Steam, the
 * PlayStation App). The discount, when there is one, is the only coloured
 * thing on it: a price cut is *meaning* in the sense the design system
 * allows, and it is the reason someone is scanning this row at all.
 *
 * No fill and no border — a row, not a card. These sit inside the card, and a
 * surface each would be a card of cards; the brand mark on the left is the
 * leading edge that separates one row from the next.
 */
function StoreRow({
  name,
  brand,
  url,
  price,
  pending,
}: {
  name: string;
  brand: StoreBrand;
  url: string;
  price: StorePrice | null;
  /** The price is still being asked for. */
  pending: boolean;
}) {
  const theme = useTheme();
  const ink = readableInk(brand.color);
  const discounted = !!price && price.cut > 0;

  const spoken = price
    ? `${name}, ${formatPrice(price.amount, price.currency)}${
        discounted ? `, ${price.cut} percent off` : ''
      }. Opens the store.`
    : `${name}. Opens the store.`;

  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={spoken}
      onPress={() => {
        Linking.openURL(url).catch(() => {
          // No handler for the scheme, or the link is dead. Nothing useful to
          // say about it on a store row.
        });
      }}
      scaleTo={0.96}
      style={styles.row}>
      <View style={[styles.mark, { backgroundColor: brand.color }]}>
        {brand.icon ? (
          <Ionicons name={brand.icon} size={18} color={ink} />
        ) : (
          <Text variant="h5" style={{ color: ink }}>
            {storeInitial(name)}
          </Text>
        )}
      </View>

      <View style={styles.labels}>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {name}
        </Text>

        {price ? (
          <View style={styles.priceLine}>
            <Text variant="h5" numberOfLines={1}>
              {formatPrice(price.amount, price.currency)}
            </Text>
            {discounted && (
              <Text variant="caption" color="textMuted" style={styles.struck} numberOfLines={1}>
                {formatPrice(price.regular, price.currency)}
              </Text>
            )}
          </View>
        ) : (
          /* No number: IsThereAnyDeal does not track this store (every
             console and phone shop), or does not have this game there. The
             link is still the answer to "where". */
          <Text variant="body" color="textMuted" numberOfLines={1}>
            {pending ? 'Checking the price…' : 'Price on the store'}
          </Text>
        )}
      </View>

      {discounted && (
        <View style={styles.cutContainer}>
          {/* Opaque, for the same reason as the masthead's copy of this badge:
              a 15% wash of its own hue has no fixed background to measure
              against. */}
          <View style={[styles.cut, { backgroundColor: theme.surface }]}>
            <Text variant="label" style={{ color: theme.success }}>
              −{price.cut}%
            </Text>
          </View>
          {/* Sentence case, as every label is (DESIGN.md § 2.4): `h6`, the
              same 10 bold without `label`'s capitals. */}
          {price.isAllTimeLow && (
            <Text variant="h6" style={{ color: theme.identityGold }}>
              Lowest
            </Text>
          )}
        </View>
      )}

      <Ionicons name="open-outline" size={16} color={theme.textMuted} style={styles.open} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.x4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingVertical: Spacing.x8,
  },
  mark: {
    width: MARK,
    height: MARK,
    borderRadius: Radius.image,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Takes the row's slack, so the badge and the arrow sit at its far end. */
  labels: { flex: 1, gap: 1 },
  priceLine: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.x4 },
  struck: { textDecorationLine: 'line-through' },
  /* A step of air above the second group: it is a different kind of shop. */
  othersHead: { marginTop: Spacing.x12 },
  /* The folding list's toggle: as wide as its label, tall enough to hit. */
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.x4,
    minHeight: TapTarget,
  },
  cutContainer: {
    alignItems: 'center',
    gap: 2,
  },
  cut: {
    paddingHorizontal: Spacing.x8,
    paddingVertical: 1,
    borderRadius: Radius.image,
  },
  open: { marginLeft: Spacing.x4 },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { InfoCardButton } from '@/components/ui/info-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Elevation, Radius, Spacing, TapTarget, withAlpha } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { getGameDetails, type GameDetails } from '@/lib/games/igdb';
import { parseGameId } from '@/lib/games';

/**
 * The full IGDB record for a game, behind a button.
 *
 * ## Why it is disclosed rather than printed
 *
 * There are eleven fields here and most games fill most of them, which is
 * upwards of forty values. Printed inline they would be the largest block on the
 * Overview tab — longer than the synopsis and far longer than the reviews — and
 * they are reference material: you look at "Game Engine: Unity" once, on purpose,
 * and never again. That is the definition of progressive disclosure, and it is
 * why the button says what it will show rather than "More".
 *
 * ## Every row is omitted when empty
 *
 * IGDB's coverage is uneven — an indie game may have themes and no engine, a
 * 1997 release may have neither — and a column of "Series: –, Franchise: –,
 * Engine: –" is three facts the app does not have, presented as three facts it
 * does. The reference screenshot prints dashes; this does not, because a missing
 * row already says the same thing without spending a line on it.
 *
 * Age ratings and languages are the two the reference does not carry at all, and
 * both were asked for: a rating board's verdict is often the only content
 * warning a game page has, and whether a game is playable in your language is a
 * purchase decision rather than trivia.
 *
 * ## Two triggers, and why the card one is no longer the default
 *
 * `trigger="row"` is what the game page uses: a single control at the foot of
 * the **About** card, shaped exactly like "See all reviews" at the foot of the
 * Reviews card. That is where it belongs — the synopsis and the full record are
 * the same subject at two depths, and as its own panel it was a second box
 * saying "there is more about this game" directly under the box that *was* more
 * about this game. It also drops the description line: a footer under a
 * paragraph does not need to list what is behind it, and the row is the way out
 * of the paragraph rather than an advertisement for another page.
 *
 * `trigger="card"` keeps the standalone `<InfoCardButton>` for any caller that
 * has no card to sit inside.
 */
export function GameDetailsSheet({
  gameId,
  trigger = 'card',
}: {
  gameId: string;
  /** `row` for a footer inside another card; `card` for a panel of its own. */
  trigger?: 'card' | 'row';
}) {
  const theme = useTheme();
  const accent = useAccent();
  const [open, setOpen] = useState(false);

  const parsed = parseGameId(gameId);
  const igdbId = parsed?.source === 'igdb' ? parsed.sourceId : null;

  const details = useQuery({
    queryKey: ['game-details', igdbId],
    queryFn: ({ signal }) => getGameDetails(igdbId!, signal),
    /* Only fetched once opened. It is a whole extra IGDB round trip for a panel
       most visits never expand, and the Overview tab already fires four. */
    enabled: !!igdbId && open,
    staleTime: 24 * 60 * 60_000,
    retry: false,
  });

  // Nothing to disclose for a legacy Steam or RAWG row: this is IGDB-only data.
  if (!igdbId) return null;

  return (
    <View style={trigger === 'row' ? undefined : styles.wrap}>
      {trigger === 'row' ? (
        /* The footer of the card it sits in. Deliberately identical to "See all
           reviews" on the Reviews card — same fill, same height, same chevron —
           because the two answer the same shape of question and a second footer
           style would read as a different kind of control. */
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="More information about this game"
          onPress={() => setOpen(true)}
          scaleTo={0.98}
          style={StyleSheet.flatten([
            styles.footer,
            { backgroundColor: accent.m3.surfaceContainerHigh },
          ])}>
          <Text variant="body">More information</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
        </PressableScale>
      ) : (
        /* A card that is a door, matching every other panel on the tab rather
           than being the one full-width button among them. The chevron is what
           says it opens something; the line under the title says what. */
        <InfoCardButton
          title="More information"
          accessibilityLabel="More information about this game"
          onPress={() => setOpen(true)}
          action={<Ionicons name="chevron-forward" size={18} color={accent.quietInk} />}>
          <Text variant="body" color="textSecondary">
            Genres, themes, modes, perspectives, engines, age ratings and languages.
          </Text>
        </InfoCardButton>
      )}

      {/*
        A card over the page, not an inline expansion.

        Inline, opening it pushed everything below — Studios, Franchise, Cast,
        Screenshots — down by several hundred dp, so the act of reading one fact
        rearranged the rest of the tab and lost your place in it. A card owns its
        own scroll and puts the page back exactly as it was when dismissed.

        `transparent` with a scrim rather than a full sheet, because this is a
        glance: the page stays visible behind it, which is what says "you are
        still on the game" without a title bar saying so.
      */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {/* The scrim is the dismiss target. `Pressable` rather than
            `PressableScale` — a backdrop that shrinks when you tap it reads as a
            button rather than as empty space. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => setOpen(false)}
          style={[styles.scrim, { backgroundColor: withAlpha(theme.shadowInk, 0.6) }]}>
          {/* Stops a tap inside the card falling through to the scrim. */}
          <Pressable
            style={[styles.card, Elevation.overlay, { backgroundColor: theme.surfaceElevated }]}
            onPress={() => undefined}>
            <View style={styles.cardHead}>
              <Text variant="h3" style={styles.cardTitle}>
                Information
              </Text>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => setOpen(false)}
                scaleTo={0.9}
                hitSlop={Spacing.x8}
                style={StyleSheet.flatten(styles.close)}>
                <Ionicons name="close" size={20} color={theme.text} />
              </PressableScale>
            </View>

            <ScrollView
              contentContainerStyle={styles.cardBody}
              showsVerticalScrollIndicator={false}>
              {details.isLoading && (
                <Text variant="bodySmall" color="textMuted">
                  Loading details…
                </Text>
              )}

              {details.isError && (
                <Text variant="bodySmall" color="textMuted">
                  Could not load the details for this game.
                </Text>
              )}

              {details.data && <DetailRows details={details.data} />}

              {details.isSuccess && !details.data && (
                <Text variant="bodySmall" color="textMuted">
                  IGDB has no extra information for this game.
                </Text>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function DetailRows({ details }: { details: GameDetails }) {
  const rows: { label: string; values: string[] }[] = [
    { label: 'Developers', values: details.developers },
    { label: 'Publishers', values: details.publishers },
    { label: 'Genres', values: details.genres },
    { label: 'Themes', values: details.themes },
    { label: 'Game modes', values: details.gameModes },
    { label: 'Player perspectives', values: details.playerPerspectives },
    { label: 'Series', values: details.series ? [details.series] : [] },
    { label: 'Franchises', values: details.franchises },
    { label: 'Game engine', values: details.engines },
    {
      label: 'Age ratings',
      values: details.ageRatings.map((entry) => `${entry.organization} ${entry.rating}`),
    },
    { label: 'Languages', values: details.languages },
  ].filter((row) => row.values.length > 0);

  if (rows.length === 0) {
    return (
      <Text variant="bodySmall" color="textMuted">
        IGDB has no extra information for this game.
      </Text>
    );
  }

  return (
    <>
      {rows.map((row) => (
        <DetailRow key={row.label} label={row.label} values={row.values} />
      ))}
    </>
  );
}

/**
 * One labelled row.
 *
 * Label above values rather than beside them. The reference is a desktop layout
 * with four columns; on a 390dp phone a two-column row gives the values about
 * 200dp, and "Player perspectives" alone is wider than the label column it would
 * need. Stacked, every value gets the full measure.
 *
 * Values are joined into one wrapping line rather than laid out as chips: these
 * are not tappable and not filters, and a run of pill-shaped capsules reads as a
 * row of controls — the same argument `<Chip>` already makes for metadata.
 */
function DetailRow({ label, values }: { label: string; values: string[] }) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <Text variant="label" color="textMuted">
        {label}
      </Text>
      <Text variant="body" style={{ color: theme.text }}>
        {values.join(', ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.x12 },
  /* Matches `styles.seeAll` in `app/game/[id].tsx` exactly. The two are the same
     object in two cards, and they are written twice rather than shared because
     each is three lines of layout with no behaviour — a `<CardFooterLink>`
     component would be indirection around a flex row. If a third appears, that
     is the point to extract it. */
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.x16,
    minHeight: TapTarget,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  scrim: { flex: 1, justifyContent: 'center', padding: Spacing.x24 },
  /* Capped at 70% of the display so it always reads as a card sitting *on* the
     page rather than as a new screen — the page has to stay visible around it. */
  card: { maxHeight: '70%', borderRadius: Radius.card, overflow: 'hidden' },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    paddingLeft: Spacing.x16,
    paddingRight: Spacing.x8,
    paddingTop: Spacing.x12,
  },
  cardTitle: { flex: 1 },
  close: {
    width: TapTarget,
    height: TapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { padding: Spacing.x16, gap: Spacing.x16 },
  row: { gap: Spacing.x4 },
});

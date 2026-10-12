import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { ReviewQuote } from '@/components/review-quote';
import { ScoreTile } from '@/components/ui/score-tile';
import { ArtRail, SectionHeader, SectionInsetProvider, SectionMore } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { ratingVerdict } from '@/constants/score';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCriticSummary, quotedReviews, type CriticReview } from '@/lib/games/critics';

/**
 * How many lines of a review a card in the rail prints. Six of `reviewExcerpt`
 * fill the frame; a card with a foot — a score — gives one up to it.
 */
const QUOTE_LINES = 6;

type Subject = { gameId: string; title: string; releaseYear: number | null };

/**
 * What OpenCritic has for a game: one query, under one key, for whoever asks.
 *
 * The reviews sheet reads it; the game page asks for it as the page opens
 * (`<GameSheets>`), so that by the time the sheet is raised the answer is
 * there and the critics' section does not arrive after the sheet has, pushing
 * every review under it down the screen.
 */
export function useCriticSummary({ gameId, title, releaseYear }: Subject) {
  return useQuery({
    queryKey: ['critic-reviews', gameId],
    queryFn: () => getCriticSummary({ title, year: releaseYear, gameId }),
    enabled: !!title,
    /* The function keeps its own answer for days; this only spares the round
       trip while the app is open. */
    staleTime: 24 * 60 * 60_000,
    retry: false,
  });
}

export type CriticReviewsProps = Subject & {
  /**
   * IGDB's aggregate of critics' scores, for a game OpenCritic has nothing to
   * quote from. One averaged number; IGDB publishes no spread and no words.
   */
  igdbScore: number | null;
};

/**
 * What the critics made of a game: the section at the head of the reviews
 * sheet, over what the people here wrote.
 *
 * ```text
 *   Critic reviews                         OpenCritic
 *   88 average · 54 reviews
 *   ┌───────────────┐ ┌───────────────┐ ┌──────
 *   │ “A quote from │ │ “Another      │ │ “And
 *   │ the review…”  │ │ outlet…”      │ │
 *   │            90 │ │            85 │ │
 *   └───────────────┘ └───────────────┘ └──────
 *   IGN               Eurogamer         Polyg…
 * ```
 *
 * ## It moved here from the game page
 *
 * This was a rail on the Overview, under the members' reviews. The owner's
 * direction (2026-10-09): "move the critic's review to inside the review
 * sheet… a section at the top for critic's reviews, and then below is the
 * app's user reviews". So everything anybody wrote about the game is in one
 * place, the trade press first, and the Overview has no critics on it.
 *
 * ## Where it comes from
 *
 * OpenCritic, through the `opencritic` Edge Function — IGDB has an averaged
 * number and nothing an outlet wrote. One card per outlet (`<ReviewQuote>`),
 * each opening the review it quotes; the heading's link goes to the game's
 * OpenCritic page, which is also the attribution their data asks for.
 *
 * ## When OpenCritic has nothing
 *
 * Which is most of the catalogue — everything before about 2013, most small
 * releases, and any deployment without the function. Then the section is
 * IGDB's aggregate, said plainly as what it is: one number, and whose. With
 * neither, there is no section and the sheet opens on the app's own reviews.
 *
 * The cards are the sheet's neutral `surface`, as its rows are — the sheet is
 * raised over the game's page and is not that page's colour.
 */
export function CriticReviews({ gameId, title, releaseYear, igdbScore }: CriticReviewsProps) {
  const theme = useTheme();
  const critics = useCriticSummary({ gameId, title, releaseYear });

  const summary = critics.data;
  const reviews = useMemo(() => quotedReviews(summary), [summary]);

  if (!summary || reviews.length === 0) {
    if (igdbScore === null) return null;

    return (
      <SectionInsetProvider inset={Spacing.x16}>
        <View>
          <SectionHeader title="Critic reviews" />
          <View style={styles.aggregate}>
            <View style={styles.aggregateText}>
              <Text variant="h4">{ratingVerdict(igdbScore, 999).label}</Text>
              {/* No quotes and no spread to draw: IGDB publishes one averaged
                  number and a count. Anything more here would be invented. */}
              <Text variant="caption" color="textMuted">
                An average of critics’ scores, from IGDB
              </Text>
            </View>
            <ScoreTile score={igdbScore} size="medium" />
          </View>
        </View>
      </SectionInsetProvider>
    );
  }

  const url = summary.url;
  const facts = [
    summary.average !== null ? `${summary.average} average` : null,
    summary.count > 0 ? `${summary.count} ${summary.count === 1 ? 'review' : 'reviews'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <SectionInsetProvider inset={Spacing.x16}>
      <View>
        <SectionHeader
          title="Critic reviews"
          moreSlot={
            url ? (
              <SectionMore
                label="OpenCritic"
                accessibilityLabel={`See every critic review of ${title} on OpenCritic`}
                onPress={() => {
                  Linking.openURL(url).catch(() => {
                    // No handler for the scheme; nothing useful to say about it.
                  });
                }}
              />
            ) : undefined
          }
        />

        {/* Under the heading, not in its row: beside "Critic reviews" and the
            link there is no room for it on a narrow phone. */}
        {!!facts && (
          <Text variant="bodySmall" color="textSecondary" style={styles.facts}>
            {facts}
          </Text>
        )}

        <ArtRail
          data={reviews}
          keyOf={(review) => `${review.outlet}-${review.url ?? review.score ?? ''}`}
          shape="wide"
          renderArt={(review, size) => (
            /* A quote and a score. No name inside it — the outlet is printed
               under the card. An unscored review has no foot, and keeps the
               sixth line. */
            <ReviewQuote
              text={review.snippet ?? ''}
              quoted
              score={review.score}
              lines={review.score !== null ? QUOTE_LINES - 1 : QUOTE_LINES}
              fill={theme.surface}
              size={size}
            />
          )}
          titleOf={(review) => review.outlet}
          subtitleOf={criticLine}
          labelOf={(review) =>
            [
              review.outlet,
              review.score !== null ? `scored it ${review.score}` : null,
              review.snippet,
              review.url ? 'Opens the review.' : null,
            ]
              .filter(Boolean)
              .join('. ')
          }
          onPressItem={(review) => {
            if (!review.url) return;
            Linking.openURL(review.url).catch(() => {
              // No handler for the scheme; nothing useful to say about it.
            });
          }}
        />
      </View>
    </SectionInsetProvider>
  );
}

/** Under the outlet's name: who wrote it and what they gave it. */
function criticLine(review: CriticReview): string | null {
  const parts = [review.score !== null ? `${review.score} / 100` : 'Unscored', review.author];
  return parts.filter(Boolean).join(' · ') || null;
}

const styles = StyleSheet.create({
  facts: { paddingHorizontal: Spacing.x16 },
  aggregate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingHorizontal: Spacing.x16,
  },
  aggregateText: { flex: 1, gap: 2 },
});

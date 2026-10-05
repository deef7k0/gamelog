import { StyleSheet, View } from 'react-native';

import { ReviewCard } from '@/components/review-card';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Card, Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import type { TopReview } from '@/lib/api';

/**
 * The skeleton's score placeholder, matching `<ScoreTile>`'s edge.
 *
 * Only the loading state uses it now. The empty state used to draw the same
 * square with a pencil glyph in it, which put a picture of the act of writing in
 * a well built to hold a number — that is gone and the empty state is type alone.
 */
const TILE = 52;

/**
 * How much of the review is printed, when the caller does not say.
 *
 * Three, not two. Two lines of an eight-line review is a fragment — usually the
 * reviewer clearing their throat — and on Surprise Me, where this is most of
 * what you have to go on, the third line is often the first one that says
 * anything. The cost is roughly 16dp of a screen that must not scroll, which
 * `revealLayout` already absorbs through its flex spacer.
 *
 * **The default is Surprise Me's number, and the game page overrides it to five.**
 * That screen scrolls and this card is the only review on it; Surprise Me does
 * not scroll and two more lines there come straight out of the artwork. One
 * component, two rooms — which is exactly what a prop is for, and why this is
 * not simply raised to five for everybody.
 */
const BODY_LINES = 3;

export type TopReviewCardProps = {
  review: TopReview | null;
  loading: boolean;
  liked: boolean;
  onToggleLike: () => void;
  onOpenReview: () => void;
  /** Opens the log form for this game, where the first review gets written. */
  onWriteReview: () => void;
  /**
   * Drop the surface and the padding — this is already inside a card.
   *
   * The game page puts this inside an `<InfoCard title="Reviews">`, where its
   * own `<Card>` was a card inside a card: two nested rounded rectangles, two
   * fills one tone apart, for one piece of content. Surprise Me has no such
   * wrapper and still needs the surface, which is why this is a prop rather than
   * a decision baked in either direction.
   */
  bare?: boolean;
  /**
   * Rendered at the bottom of the card, inside it.
   *
   * A slot keeps the caller in charge of what goes there while the card stays in
   * charge of the box it goes in. The game page's "See all reviews" lived here
   * until its sections became SimpMusic's; it is the Reviews heading's More now.
   */
  footer?: React.ReactNode;
  /**
   * The whole card is the link, and nothing inside it is a button.
   *
   * For Surprise Me, where this is one of two cards under the artwork on a
   * screen that must not scroll. Both of its controls were spending a row each
   * to say what tapping the card already does — "Write the first review" on the
   * empty state, and the like row on the full one — and the empty state is the
   * common case there, so most cards were a heading, a sentence and a button
   * repeating the sentence.
   *
   * Off everywhere else. The game page's card sits in a tab you scroll, where a
   * like is a real action and the room for it exists.
   */
  compact?: boolean;
  /** Lines of prose before the clamp. Defaults to `BODY_LINES` — see its note. */
  lines?: number;
};

/**
 * What one person thought, under the game they thought it about.
 *
 * Surprise Me's, under the dealt card. The game page's Overview shared it —
 * both ask a game the same question, is this worth my evening — until its
 * reviews became a rail of `<ReviewQuote>` cards (`<MemberReviewsWidget>`).
 * `bare`, `footer` and the five-line `lines` below were that page's.
 *
 * ## Why the score is the artwork
 *
 * A review card usually leads with the reviewer. This leads with the number,
 * because on a screen you are *thumbing through* the number is the only part
 * that survives a half-second glance — and it is the one piece of a review that
 * this feature's whole question ("is this worth my evening") actually turns on.
 * The prose is there for the half-second after.
 *
 * ## The colour
 *
 * `scoreColor()` and nothing else. Score is one of the three things CLAUDE.md
 * permits colour to come from, and it aliases onto the existing ramp rather than
 * inventing a hex — a 92 is the same green here as in a metadata row and on a
 * review page. The ink on it is `readableInk()`, so amber and green both get the
 * dark number they need while red keeps a light one; picking one ink for all
 * three would fail on at least one band.
 *
 * ## Why the word is under the number
 *
 * "Excellent" / "Mixed" is the second carrier. The band is a colour and a
 * number, and neither survives a protanopic reader well on its own — the word
 * does, and `labelFor()` is already the app's name for it.
 */
export function TopReviewCard({
  review,
  loading,
  liked,
  onToggleLike,
  onOpenReview,
  onWriteReview,
  bare = false,
  footer,
  compact = false,
  lines = BODY_LINES,
}: TopReviewCardProps) {
  if (loading) {
    return (
      <Shell bare={bare}>
        <View style={styles.row}>
          <Skeleton width={TILE} height={TILE} radius={Radius.sm} />
          <View style={styles.body}>
            <Skeleton width="44%" height={12} radius={Radius.sm} />
            <Skeleton width="92%" height={11} radius={Radius.sm} />
            <Skeleton width="68%" height={11} radius={Radius.sm} />
          </View>
        </View>
      </Shell>
    );
  }

  /*
   * Nobody has written about this one yet.
   *
   * Kept as a block rather than collapsed to nothing: on a screen you are dealing
   * through, a card that vanishes on the games nobody has reviewed — which is most
   * of a random pool — is a surface that twitches every deal. It is no longer the
   * same *height* as the review state, since the 52dp glyph well that used to
   * guarantee that is gone, but a two-line block is a block.
   *
   * It is also the better offer. A random pool is mostly games nobody here has
   * reviewed, so this is the app's most frequent chance to ask for writing —
   * from someone who has just been handed the game and has an opinion or is
   * about to get one.
   */
  if (!review) {
    return (
      <Shell bare={bare} onPress={compact ? onWriteReview : undefined} label="Write a review">
        {/*
          Two lines of type, and nothing beside them.

          It led with a 52dp outlined square holding a pencil glyph, mirroring the
          `<ScoreTile>` that occupies that slot when there *is* a review. The
          mirror was the mistake: the tile is there to carry a number, and an empty
          one carries a picture of the act of writing — an icon restating the
          sentence next to it, in a box drawn to hold something it has not got.
          What is left is the sentence, which was always the content.
        */}
        <View style={styles.body}>
          <Text variant="h4">No reviews yet</Text>
          <Text variant="bodySmall" color="textMuted" numberOfLines={BODY_LINES}>
            Nobody here has written about this one. Want to be the first?
          </Text>
        </View>

        {/* The card itself is the control in `compact`; a button under a
            sentence that says the same thing is a second one. */}
        {!compact && (
          <View style={styles.actions}>
            <Button
              title="Write the first review"
              icon="pencil"
              size="small"
              onPress={onWriteReview}
            />
          </View>
        )}
      </Shell>
    );
  }

  const { log, likes } = review;
  const name = log.profile?.display_name || log.profile?.username || 'Someone';

  return (
    <Shell
      bare={bare}
      onPress={compact ? onOpenReview : undefined}
      label={`${name}’s review. Read all of it.`}>
      {/*
        The card's whole interior is `<ReviewCard>` now, shared with the "see all
        reviews" sheet.

        The two used to be separate implementations of the same idea and they had
        drifted into different objects — this one led with a 62dp score tile
        floated beside the prose, that one with an avatar row and a timestamp.
        Both show one person's review of a game you are already looking at, so
        both get the same shape, and the shape lives in one file.
      */}
      <ReviewCard
        log={log}
        lines={lines}
        liked={liked}
        likeCount={likes}
        onToggleLike={onToggleLike}
        onOpen={onOpenReview}
        wholeCardLink={compact}
      />

      {/* The caller's own footer — on the game page, "See all reviews". It goes
          here rather than in a card of its own below, which is what it used to
          be: two stacked panels for one subject. */}
      {footer}
    </Shell>
  );
}

/**
 * The card around the card, or nothing at all.
 *
 * Declared at module scope rather than inside `<TopReviewCard>`: a component
 * created during render is a new type on every render, so React unmounts and
 * remounts its whole subtree each time — and the React Compiler lint rejects it
 * outright. One shell for all three states is what keeps `bare` honoured in the
 * loading and empty ones too, rather than in whichever two somebody remembered.
 */
function Shell({
  bare,
  onPress,
  label,
  children,
}: {
  bare: boolean;
  /** Given one, the whole card is the link — see `TopReviewCardProps.compact`. */
  onPress?: () => void;
  label?: string;
  children: React.ReactNode;
}) {
  const inner = bare ? (
    <View style={styles.bare}>{children}</View>
  ) : (
    /*
      No `panel`, so this takes `Radius.card` (6) like every other card in the
      app rather than `Radius.cardLarge` (18).

      `cardLarge` is the game page's panel shape and it belongs there, on
      containers big enough to carry an 18dp corner. Surprise Me stacks two small
      cards under the artwork, where the same corner reads as a rounded tile
      rather than a card — the corners were the loudest thing about two objects
      that are supposed to sit quietly under a piece of box art.

      Only this screen is affected: the game page passes `bare` and renders no
      `<Card>` at all.
    */
    <Card tinted elevated padded={false} style={styles.pad}>
      {children}
    </Card>
  );

  if (!onPress) return inner;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.99}>
      {inner}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.x12, paddingVertical: Spacing.x8 },
  /* No fill, no padding, no corner — the card around it owns all three. Only the
     internal rhythm survives. */
  bare: { gap: Spacing.x12 },
  row: { flexDirection: 'row', gap: Spacing.x12 },
  body: { flex: 1, gap: Spacing.x4, justifyContent: 'center' },
  /* `flex-end`, with the heart pushed back out to the left by its own auto
     margin. Not `space-between`: the empty state has no heart, and space-between
     would leave its lone button stranded on the left while the review state's sat
     on the right — the one control in this card moving corners depending on
     whether anybody has written yet. */
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.x12,
    marginTop: Spacing.x8,
  },
  /* Slop, not padding: the row's height is set by the card and an 18dp glyph
     would otherwise be a 22dp target. This lifts it to `TapTarget` without
     making the block taller. */
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x4,
    minHeight: TapTarget - Spacing.x16,
    paddingRight: Spacing.x8,
    marginRight: 'auto',
  },
});

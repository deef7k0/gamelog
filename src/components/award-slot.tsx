import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/ui/icon-button';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { accentRoles, Palette, Radius, Spacing } from '@/constants/theme';
import { useGameAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import type { AwardSlot as AwardSlotData } from '@/lib/api';

/**
 * The winner's box art, in dp.
 *
 * A fixed number rather than a `Spacing` step, for the reason artwork always is
 * here: retuning the spacing ladder should move the interface and leave the art
 * where it is. 84 wide reads as real box art beside two lines of type without
 * turning the row into a card with a poster in it.
 */
const ART_WIDTH = 84;

/**
 * Gold — the ballot's own colour, resolved once at module scope.
 *
 * An alias onto `identityGold`, not a new hex: an award is *meaning*, and
 * meaning joins the ten-hue ramp rather than extending the palette. It is
 * already the app's word for this — `<CollectionMosaic award>` lays a gold
 * trophy over an award show's four covers, on its tile and again across the
 * banner at the top of this very screen. The categories below are that same
 * mark, continued into the programme.
 *
 * `accentRoles` is a pure function of the palette, so calling it here costs one
 * evaluation for the module rather than one per row. `.elevated` is the crown's
 * fill: gold mixed into `surfaceElevated` with the luminance put back, so it is
 * *opaque* and reads identically on every card no matter which hue that card is
 * lit in. A 14% gold wash would have composited differently on all eight.
 */
const GOLD = accentRoles(Palette.identityGold);

export type AwardSlotProps = {
  award: AwardSlotData;
  /** Owner-only affordances: the picker, the note field, reorder and delete. */
  editable: boolean;
  /** Position in the ballot, for the reorder arrows' bounds. */
  index: number;
  count: number;
  onPickGame: () => void;
  onEditNote: () => void;
  onRename: () => void;
  onMove: (delta: -1 | 1) => void;
  onDelete: () => void;
};

/**
 * One category on an award show: the art, the category, the winner, the case.
 *
 * ## The empty state is the important one
 *
 * A new show is eight of these with nothing in them, so the unfilled slot is
 * what most people meet first and it has to read as an invitation rather than a
 * failure. It is a portrait well the exact size of the box art that will replace
 * it, with a `+` in the middle — the same shape, so filling it swaps art in
 * rather than reflowing the row. A grey rectangle of a different size would make
 * every fresh ballot look like eight broken images.
 *
 * ## Why the note is inside the container
 *
 * The owner's case for the game is the point of an award show — a ranked list
 * already exists for "these are good in this order", and what it cannot say is
 * *why*. So the note sits with the award and the game rather than behind a
 * disclosure: on somebody else's show it is the thing you came to read.
 *
 * Read-only viewers get none of the controls, and an empty category renders as
 * "Not awarded" rather than as an inviting `+` they cannot use.
 *
 * ## Two colours, and they say different things
 *
 * **Gold is the award. The winner's own hue is the game.** Every category label
 * is gold whether or not anything has won it yet — which is the point, because
 * the award exists before the winner does; that is the whole reason
 * `list_awards` is a separate table from `list_items`. A fresh show therefore
 * opens as eight gold categories on grey, reading as a programme waiting to be
 * filled in rather than as eight broken cards.
 *
 * The card itself stays grey until a game wins it, and then takes *that game's*
 * colour — read from its box art by `useGameAccent`, the same hue its own page
 * runs on. So naming a winner literally lights the slot, and eight winners give
 * the ballot eight different lights while the gold running down the left holds
 * them together as one document.
 *
 * This is the one list in the app allowed to do that. The rule against a colour
 * per game (see `use-accent`: "twenty games in a list is twenty hues") is about
 * *browsing* — a feed or a grid, where colour would claim significance that a
 * scroll position does not have. An award show is the inverse: every row is a
 * deliberate, argued statement about one game, with the curator's reasons
 * attached. Here the hue is not noise, it is the subject. Note that this is a
 * **tint**, never `<SoftGlow>` or `<Ambience>` — those stay banned on any screen
 * showing several games, and `tint()` restores the surface's original luminance
 * so every text pair on the card measures what it did on the grey (verified:
 * `textMuted` moves by at most 0.03 across all ten hues).
 */
export function AwardSlotRow({
  award,
  editable,
  index,
  count,
  onPickGame,
  onEditNote,
  onRename,
  onMove,
  onDelete,
}: AwardSlotProps) {
  const theme = useTheme();
  const game = award.game;

  /* Unconditional, because hooks are: an empty slot resolves to the house blue
     and simply never spends it. The extraction is cached in `AsyncStorage`
     forever and keyed on the URL, so a ballot costs eight 3 KB thumbnails once
     and nothing on every visit after. */
  const accent = useGameAccent(game?.cover_url, game?.genres);
  const lit = !!game;

  /* Top of the ballot. Not a claim about prestige the data cannot support — it
     says exactly what is true, that this category is first, and the owner's
     reorder arrows are what put it there. */
  const headline = index === 0;

  return (
    <View style={[styles.container, { backgroundColor: lit ? accent.surface : theme.surface }]}>
      <View style={styles.body}>
        {game ? (
          /* Straight through to the game — an award show is a set of
             recommendations, and the whole point of naming a winner is that a
             reader can go and look at it. */
          <Link href={{ pathname: '/game/[id]', params: { id: game.id } }} asChild>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`${game.title}, winner of ${award.label}`}
              scaleTo={0.96}>
              <Poster
                coverUrl={game.cover_url}
                heroUrl={game.hero_url}
                title={game.title}
                width={ART_WIDTH}
                rounded="image"
              />
            </PressableScale>
          </Link>
        ) : (
          <EmptySlot label={award.label} editable={editable} onPress={onPickGame} />
        )}

        <View style={styles.text}>
          {/* The head of the programme wears the trophy, and it is the only one
              in the ballot: gold at full strength once per screen is a crown,
              and eight of them would be wallpaper. Colour is not carrying this
              on its own — the pill's shape and the glyph say it too. */}
          {headline ? (
            <View style={[styles.crown, { backgroundColor: GOLD.elevated }]}>
              <Ionicons name="trophy" size={11} color={GOLD.color} />
              <Text
                variant="label"
                numberOfLines={2}
                style={StyleSheet.flatten([styles.crownLabel, { color: GOLD.color }])}>
                {award.label}
              </Text>
            </View>
          ) : (
            <Text variant="label" numberOfLines={2} style={{ color: GOLD.color }}>
              {award.label}
            </Text>
          )}

          {game ? (
            <Text variant="h3" numberOfLines={2}>
              {game.title}
            </Text>
          ) : (
            <Text variant="h3" color="textMuted" numberOfLines={1}>
              {editable ? 'Choose a winner' : 'Not awarded'}
            </Text>
          )}

          {!!game && (
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {[game.developer, game.release_year].filter(Boolean).join(' · ')}
            </Text>
          )}

          {/* The owner's case. A rule down the left rather than italics or a
              box: it marks the words as quoted from the curator without
              styling them differently from everything else you read here.

              In the winner's colour, because that is what the rule is pointing
              at — the argument and the game it is about, tied by the one hue.
              `onSurface` rather than `color`: a winner whose art cannot be read
              *and* whose genres are unknown — a legacy Steam row with a dead
              cover URL — falls all the way back to the house blue, which is
              3.74:1 raw. `onSurface` is the variant that has already been
              lifted past AA, whatever hue arrives. */}
          {award.note ? (
            <PressableScale
              accessibilityRole={editable ? 'button' : 'text'}
              onPress={editable ? onEditNote : undefined}
              scaleTo={editable ? 0.99 : 1}
              style={StyleSheet.flatten([
                styles.note,
                { borderLeftColor: lit ? accent.onSurface : theme.borderStrong },
              ])}>
              <Text variant="bodySmall" color="textSecondary">
                {award.note}
              </Text>
            </PressableScale>
          ) : (
            editable && (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`Say why ${game?.title ?? 'this game'} wins ${award.label}`}
                onPress={onEditNote}
                scaleTo={0.99}
                style={styles.addNote}>
                <Ionicons name="create-outline" size={13} color={theme.textMuted} />
                <Text variant="bodySmall" color="textMuted">
                  Why does it win?
                </Text>
              </PressableScale>
            )
          )}
        </View>
      </View>

      {editable && (
        <View style={[styles.tools, { borderTopColor: theme.border }]}>
          <IconButton
            icon="chevron-up"
            accessibilityLabel={`Move ${award.label} up`}
            size="small"
            tone="plain"
            disabled={index === 0}
            onPress={() => onMove(-1)}
          />
          <IconButton
            icon="chevron-down"
            accessibilityLabel={`Move ${award.label} down`}
            size="small"
            tone="plain"
            disabled={index === count - 1}
            onPress={() => onMove(1)}
          />

          <View style={styles.spacer} />

          {!!game && (
            <IconButton
              icon="swap-horizontal"
              accessibilityLabel={`Change the winner of ${award.label}`}
              size="small"
              tone="plain"
              onPress={onPickGame}
            />
          )}
          <IconButton
            icon="pricetag-outline"
            accessibilityLabel={`Rename ${award.label}`}
            size="small"
            tone="plain"
            onPress={onRename}
          />
          <IconButton
            icon="trash-outline"
            accessibilityLabel={`Delete ${award.label}`}
            size="small"
            tone="danger"
            onPress={onDelete}
          />
        </View>
      )}
    </View>
  );
}

/**
 * The well that stands in for box art before anything has won.
 *
 * Exactly the poster's footprint and radius, so choosing a winner replaces the
 * rectangle in place instead of resizing the row — a ballot that reflowed every
 * time you filled one in would make eight quick choices feel like eight
 * separate screens.
 */
function EmptySlot({
  label,
  editable,
  onPress,
}: {
  label: string;
  editable: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  const box = [
    styles.empty,
    {
      width: ART_WIDTH,
      height: ART_WIDTH / (2 / 3),
      backgroundColor: theme.surfaceElevated,
      borderColor: theme.borderStrong,
    },
  ];

  if (!editable) {
    return (
      <View style={box}>
        <Ionicons name="remove" size={22} color={theme.textMuted} />
      </View>
    );
  }

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Choose the winner of ${label}`}
      onPress={onPress}
      scaleTo={0.95}
      style={StyleSheet.flatten(box)}>
      <Ionicons name="add" size={28} color={theme.textSecondary} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: Radius.card, overflow: 'hidden' },
  body: { flexDirection: 'row', gap: Spacing.x16, padding: Spacing.x16 },
  /* Shrinks rather than pushing the row wide, so a long game title wraps
     instead of shoving the art off the left edge. */
  text: { flex: 1, gap: Spacing.x4, justifyContent: 'center' },
  /* `flex-start` so the pill hugs its label instead of stretching to the
     column: a full-width gold bar would read as a section header for
     everything under it, which is the opposite of what it marks. Pill is the
     legal shape here — this is a badge, not a control. */
  crown: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x4,
    paddingLeft: Spacing.x8,
    paddingRight: Spacing.x12,
    paddingVertical: Spacing.x4,
    borderRadius: Radius.pill,
  },
  /* Wraps inside the pill rather than pushing it past the card's edge — a
     renamed category can be any length. */
  crownLabel: { flexShrink: 1 },
  /* Dashed, because a solid outline at this size reads as a disabled button
     rather than as a space waiting to be filled. */
  empty: {
    borderRadius: Radius.image,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { borderLeftWidth: 2, paddingLeft: Spacing.x12, marginTop: Spacing.x4 },
  addNote: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4, marginTop: Spacing.x4 },
  /* A rule above the controls rather than a second surface step: the tools are
     part of this card, and another fill would read as a nested block. */
  tools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x4,
    paddingHorizontal: Spacing.x12,
    paddingBottom: Spacing.x8,
    paddingTop: Spacing.x8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  spacer: { flex: 1 },
});

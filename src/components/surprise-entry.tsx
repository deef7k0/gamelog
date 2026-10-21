import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Easing, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { CoverFan, type FanCard } from '@/components/ui/cover-fan';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Motion, Spacing } from '@/constants/theme';

export type SurpriseEntryCover = {
  coverUrl: string | null;
  heroUrl: string | null;
};

export type SurpriseEntryProps = {
  /**
   * Artwork for the two cards behind the face-down one.
   *
   * Passed in rather than fetched. Discover has already loaded these games for
   * the band below this one, so the deck is real box art at the cost of a prop —
   * a query here would spend a request to decorate a link. Fewer than two, or
   * none at all, is a valid state: the cards behind simply render blank, which
   * is what the first frame shows anyway.
   */
  covers?: readonly SurpriseEntryCover[];
};

/**
 * The way into Surprise Me, from Home.
 *
 * It sat on Discover for a while, third band down, between the genre grid and
 * the popularity chart. It reads better directly under the greeting: this is the
 * one control on the app that needs no input and no browsing, so the person who
 * has just opened the app and does not know what they want should meet it before
 * they meet a single ranked list.
 *
 * ## Why a deck
 *
 * This began as an icon, a heading, two lines and a chevron — the generic list
 * row, in the one place on Discover that is not a list. It also broke the rule
 * the rest of the app is built on: every other surface leads with box art, and
 * the single row promising you a *game* led with an outlined glyph.
 *
 * So it leads with games. Two real covers, fanned, behind a third card that is
 * face-down. The composition states the whole feature without a word of copy:
 * the catalogue is in there, one of them is already picked, and you cannot see
 * which. It is also the honest shape — a preview of three actual candidates
 * would be a promise this feature does not keep, because the roll draws from a
 * random offset into IGDB and not from the games Discover happens to be showing.
 *
 * ## Why the cards are tilted, when a shelf refuses to be
 *
 * A profile's library and a collection's tile overlap five covers and keep them
 * dead level (`<CoverStack>`). A diagonal was tried on the profile's shelf long
 * before that and rejected: it "read as a hand of cards dropped on a table
 * rather than as a shelf". That is the correct judgement there and the reason
 * to tilt here. A shelf is an inventory of things you own; this is a deck about
 * to be cut. Same covers, same edge, opposite metaphor.
 *
 * ## Cost
 *
 * No queries, no timers, no ambient animation. The deck moves only while a
 * finger is on it, so a band that most readers scroll straight past costs one
 * layout and nothing else.
 */
export const SurpriseEntry = memo(function SurpriseEntry({ covers = [] }: SurpriseEntryProps) {
  const router = useRouter();

  /*
   * One driver for the whole hand: 0 at rest, 1 held down. Every card reads the
   * same value and interpolates its own two positions out of it, so the fan
   * cannot desynchronise and there is one animation to reason about rather than
   * three.
   */
  const press = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  function setPress(to: number) {
    if (reduceMotion) return;
    press.set(
      withTiming(to, {
        duration: to === 1 ? Motion.fast : Motion.normal,
        // Out on the way down, back on the way up: the cut should feel like it
        // leaves your hand and settles, not like it bounces off a spring.
        easing: to === 1 ? Easing.out(Easing.cubic) : Easing.out(Easing.quad),
      })
    );
  }

  return (
    <View style={styles.band}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Surprise me. One game, one song, no browsing."
        accessibilityHint="Opens a random game with a song from its soundtrack"
        scaleTo={0.985}
        onPressIn={() => {
          setPress(1);
          /* The tick belongs to the press, not the navigation — it is the deck
             being cut. Selection rather than impact: this is picking, and the
             app already reserves notification haptics for a saved log. iOS only,
             where the Taptic Engine makes the distinction legible; Android's
             generic buzz for the same event reads as an error tone. */
          if (Platform.OS === 'ios') {
            Haptics.selectionAsync().catch(() => {});
          }
        }}
        onPressOut={() => setPress(0)}
        onPress={() => router.push('/surprise')}
        style={styles.row}>
        {/* One control, not four images: without this a screen reader reads two
            unlabelled covers and a stray icon before reaching the label. */}
        <CoverFan
          press={press}
          cards={[
            { kind: 'back' },
            ...[0, 1].map((index): FanCard => {
              const cover = covers[index];
              return { kind: 'cover', uri: cover?.coverUrl ?? cover?.heroUrl ?? null };
            }),
          ]}
        />

        <View style={styles.body}>
          {/* `h2`, the same step every band heading on this screen uses. This
              one is not inside a `<HomeSection>` on purpose — a section heading
              announces a list, and a lone control under one reads as a list that
              failed to load. */}
          <Text variant="h2" accessibilityRole="header">
            Surprise me
          </Text>

          {/*
            No call-to-action row.

            It read "Shuffle ›", and it was the only part of this card that
            repeated something the composition had already said — the heading
            names the feature and the deck shows what it does. It was also a
            fourth word for one action, on a screen where the same press is
            called "Surprise me" directly above it. The chevron went with it: the
            whole card is one button, and its accessible hint says where it goes.
          */}
        </View>
      </PressableScale>
    </View>
  );
});

const styles = StyleSheet.create({
  /* The page gutter and nothing else. On Discover this carried a top rule and
     its own 24dp of air, which is how a band separates itself from the band
     above it; Home separates its sections with a 48dp gap and draws no rules at
     all, so both would be a second, contradicting rhythm. */
  band: { paddingHorizontal: Spacing.x16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x20 },
  body: { flex: 1, gap: 2 },
});

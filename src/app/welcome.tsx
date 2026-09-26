import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Motion, Radius, Spacing, TapTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** How long each pitch holds before the next one takes over. */
const SLIDE_MS = 5000;

/**
 * The three things GameLog is for.
 *
 * **Three, and the number is the design.** A carousel of six is a thing people
 * wait out; three is a thing they read. Each names one of the app's three
 * pillars from PRODUCT.md — the catalogue, the backlog, the industry — in the
 * order somebody meets them, and none of them promises anything the app does not
 * already do.
 */
const SLIDES = [
  {
    icon: 'search' as const,
    title: 'Search your favourite games and review them',
    body: 'Every game, one catalogue. Score it out of 100 and write what you actually thought.',
  },
  {
    icon: 'bookmark' as const,
    title: 'Keep track of games you want to play next',
    body: 'Build a backlog worth coming back to, and log what you finish as you go.',
  },
  {
    icon: 'newspaper' as const,
    title: 'Stay up to date with all the news in the industry',
    body: 'Releases, trailers and stories from the outlets worth reading, in one place.',
  },
];

/**
 * What an unsigned-in reader opens the app to.
 *
 * ## Why a pitch and not the sign-in form
 *
 * The form was the first screen for the whole life of the app, which asked for a
 * password before saying what the password was for. This says what the app does
 * three times, in the reader's own terms, and keeps the one action at the bottom
 * where a thumb already is.
 *
 * ## The rotation pauses rather than being removed under Reduce Motion
 *
 * WCAG 2.2.2 is about *auto-updating* content, not about animation: text that
 * replaces itself every five seconds is a problem for a slow reader whether or
 * not it fades. So Reduce Motion does two things here — it drops the crossfade
 * **and** stops the timer, leaving the first pitch on screen with the dots still
 * tappable. Nothing becomes unreachable; it stops moving on its own.
 *
 * The dots are real buttons for the same reason. An auto-advancing carousel with
 * no way to go back is a screen that can show a reader something and then take
 * it away before they have finished with it.
 */
export default function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [index, setIndex] = useState(0);

  /*
   * Each slide schedules the one after it.
   *
   * A `setTimeout` keyed on `index` rather than a single `setInterval`, and the
   * difference is what a dot press does: changing `index` tears this down and
   * starts a fresh full-length timer, so a slide you chose gets its whole
   * `SLIDE_MS` instead of whatever was left of the previous one's. An interval
   * would have carried on to its own beat and could flip the slide half a second
   * after somebody selected it.
   *
   * The first attempt kept a restart counter in a ref and put it in this
   * dependency list. That is invalid twice over — reading `.current` during
   * render is a lint error, and mutating a ref does not re-render, so the effect
   * would never have re-run. Depending on `index` is the honest version of the
   * same idea.
   */
  useEffect(() => {
    if (reduceMotion) return;

    const timer = setTimeout(() => setIndex((current) => (current + 1) % SLIDES.length), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [reduceMotion, index]);

  const slide = SLIDES[index];

  function show(next: number) {
    setIndex(next);
    AccessibilityInfo.announceForAccessibility(SLIDES[next].title);
  }

  return (
    <Screen edges={['top', 'bottom']} padded>
      <View style={styles.root}>
        <View style={styles.brand}>
          <Text variant="h1" accessibilityRole="header">
            GameLog
          </Text>
        </View>

        {/*
          The pitch. Keyed on the index so each one mounts fresh and the
          crossfade has two elements to cross between rather than one element
          whose text changed under it.

          `accessibilityLiveRegion` is Android-only, so the explicit announce in
          `show()` covers the dot presses on both platforms; the automatic
          advance is left unannounced by design — interrupting a screen reader
          every five seconds would be worse than the rotation itself.
        */}
        <View style={styles.stage} accessibilityLiveRegion="polite">
          <Animated.View
            key={index}
            entering={reduceMotion ? undefined : FadeIn.duration(Motion.slow)}
            exiting={reduceMotion ? undefined : FadeOut.duration(Motion.fast)}
            style={styles.slide}>
            <View style={[styles.well, { backgroundColor: theme.surfaceElevated }]}>
              <Ionicons name={slide.icon} size={32} color={theme.primaryText} />
            </View>
            <Text variant="h2" style={styles.centred} accessibilityRole="header">
              {slide.title}
            </Text>
            <Text variant="body" color="textSecondary" style={styles.centred}>
              {slide.body}
            </Text>
          </Animated.View>
        </View>

        {/* Three dots, and each one is a control. See the docblock. */}
        <View style={styles.dots} accessibilityRole="tablist">
          {SLIDES.map((entry, position) => (
            <Dot
              key={entry.icon}
              active={position === index}
              label={entry.title}
              onPress={() => show(position)}
            />
          ))}
        </View>

        <View style={styles.actions}>
          <Button
            title="Log in"
            size="large"
            fullWidth
            onPress={() => router.push('/sign-in-options')}
          />
        </View>
      </View>
    </Screen>
  );
}

/**
 * One page indicator.
 *
 * The visible mark is 8dp and the target is `TapTarget`: padding does the work,
 * so the row of dots stays a row of dots rather than becoming a row of buttons.
 * `tab` is the closest role React Native has to a page indicator, and it is what
 * gives the selected one a spoken state.
 */
function Dot({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const theme = useTheme();

  return (
    /* `<PressableScale>`, like every other control in the app — not a bare
       `onTouchEnd` on a `<View>`. A raw touch handler fires on lift even if the
       finger has wandered off the target, gives no press feedback, and is not a
       press as far as an accessibility service is concerned. */
    <PressableScale
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.9}
      style={styles.dotTarget}>
      <View
        style={[
          styles.dot,
          { backgroundColor: active ? theme.primaryText : theme.borderStrong },
          active && styles.dotActive,
        ]}
      />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  brand: { alignItems: 'center', paddingTop: Spacing.x24 },
  /* Takes the slack between the wordmark and the dots, so the pitch sits in the
     optical centre of the screen and does not move as the copy's length
     changes — the three bodies wrap to different line counts. */
  stage: { flex: 1, justifyContent: 'center' },
  slide: { alignItems: 'center', gap: Spacing.x16 },
  well: {
    width: 72,
    height: 72,
    borderRadius: Radius.cardLarge,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.x8,
  },
  centred: { textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  /* The target, not the mark. `TapTarget` square with the 8dp dot centred in it,
     which is how a 8dp affordance clears a 44/48dp floor without looking like a
     button. */
  dotTarget: {
    width: TapTarget,
    height: TapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 8, height: 8, borderRadius: Radius.pill },
  /* The selected dot is wider rather than a different colour alone — shape is
     the second carrier, per the house rule that colour never works by itself. */
  dotActive: { width: 20 },
  actions: { paddingTop: Spacing.x8, paddingBottom: Spacing.x16 },
});

import { Hct, argbFromHex, hexFromArgb } from '@material/material-color-utilities';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';

import { PaintFill, inkTransition } from '@/components/ui/paint-fill';
import { PressableScale } from '@/components/ui/pressable-scale';
import {
  ControlHeight,
  Motion,
  Radius,
  SmallControlSlop,
  Spacing,
  Type,
  withAlpha,
} from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { useHomeGenres } from '@/hooks/use-home-genres';
import { MOODS, type MoodKey } from '@/lib/games/moods';
import { ALL, type HomeView } from '@/lib/home-view';

/** The colour 20 tones under `hex`, same hue and chroma — "darker, not greyer". */
function tonesDarker(hex: string, tones: number): string {
  const hct = Hct.fromInt(argbFromHex(hex));
  return hexFromArgb(Hct.from(hct.hue, hct.chroma, Math.max(0, hct.tone - tones)).toInt());
}

/** Which of the expandable chips is open, if either. */
export type OpenChip = 'mood' | 'genre' | null;

/**
 * Home's chips, SimpMusic's (`ChipGroup.kt`): **All**, a plain `Chip`, then
 * **Mood** and **Genre**, each its `ExpandableChip` — Spotify's collapsing
 * filter. Genre is this app's addition (the owner's, 2026-10-22: a genre
 * "should behave like the moods"); it is the same object.
 *
 * - **Closed**, an expandable chip is one chip like All: no fill, the outline,
 *   the word.
 * - **Tapped, it opens into its choices inside one pill** led by its word,
 *   which turns solid `primary`; the choices stand after it in the pill, the
 *   picked one on a 14% wash of the ink. The pill grows to hold them
 *   (`expandHorizontally`) and they fade in. Opening one closes the other.
 * - **Picked, it folds back to one pill reading "Mood | Relax"**: the whole
 *   pill on `primary` twenty tones darker (Material's HCT — "mixing primary
 *   with black only greys it out"), the word a brighter capsule inside it, the
 *   choice in `onPrimary` after it. Tapping either half opens it again.
 *
 * Every part is a chip's size, so the pills line up with All to the pixel: the
 * outline is drawn *over* the pill, as Compose's `border` is, and takes no
 * room. Fills pour (`<PaintFill>`) — the app's rule for any outline that turns
 * solid.
 *
 * Not ported: the reference's spinning ring round the chosen chip while its
 * feed loads (`InfiniteBorderAnimationView`). The page shows its own skeletons.
 */
export function HomeChips({
  view,
  open,
  onOpenChange,
  onChange,
}: {
  view: HomeView;
  open: OpenChip;
  onOpenChange: (open: OpenChip) => void;
  onChange: (view: HomeView) => void;
}) {
  const reduceMotion = useReducedMotion();
  const genres = useHomeGenres();
  const layout = reduceMotion ? undefined : LinearTransition.duration(Motion.slow);

  return (
    <View style={styles.row} accessibilityRole="tablist" accessibilityLabel="What Home shows">
      <Animated.View layout={layout}>
        <ChipBody
          label="All"
          selected={view.kind === 'all' && open === null}
          outlined
          onPress={() => {
            onOpenChange(null);
            onChange(ALL);
          }}
        />
      </Animated.View>

      <ExpandableChip
        label="Mood"
        options={MOODS.map((mood) => ({ key: mood.key, label: mood.label }))}
        picked={view.kind === 'mood' ? view.mood : null}
        expanded={open === 'mood'}
        onExpandedChange={(next) => onOpenChange(next ? 'mood' : null)}
        onPick={(key) => {
          onOpenChange(null);
          onChange({ kind: 'mood', mood: key as MoodKey });
        }}
      />

      {genres.length > 0 && (
        <ExpandableChip
          label="Genre"
          options={genres.map((genre) => ({ key: String(genre.id), label: genre.label }))}
          picked={view.kind === 'genre' ? String(view.genre.id) : null}
          expanded={open === 'genre'}
          onExpandedChange={(next) => onOpenChange(next ? 'genre' : null)}
          onPick={(key) => {
            const genre = genres.find((entry) => String(entry.id) === key);
            onOpenChange(null);
            if (genre) onChange({ kind: 'genre', genre: { id: genre.id, label: genre.label } });
          }}
        />
      )}
    </View>
  );
}

/** SimpMusic's `ExpandableChip`: one word that opens into its choices and folds onto the one picked. */
function ExpandableChip({
  label,
  options,
  picked,
  expanded,
  onExpandedChange,
  onPick,
}: {
  label: string;
  options: readonly { key: string; label: string }[];
  picked: string | null;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onPick: (key: string) => void;
}) {
  const { m3 } = useAccent();
  const reduceMotion = useReducedMotion();
  const foldedFill = useMemo(() => tonesDarker(m3.primary, 20), [m3.primary]);

  const choice = options.find((option) => option.key === picked) ?? null;
  const folded = !expanded && choice !== null;
  const active = expanded || choice !== null;
  const layout = reduceMotion ? undefined : LinearTransition.duration(Motion.slow);
  const appear = reduceMotion ? undefined : FadeIn.duration(Motion.normal);
  const leave = reduceMotion ? undefined : FadeOut.duration(Motion.fast);

  return (
    <Animated.View layout={layout} style={styles.group}>
      <PaintFill on={folded} color={foldedFill} />
      <ChipBody
        label={label}
        selected={active}
        accessibilityLabel={choice ? `${label}: ${choice.label}` : label}
        expanded={expanded}
        onPress={() => onExpandedChange(!expanded)}
      />
      {expanded && (
        <Animated.View entering={appear} exiting={leave} style={styles.options}>
          {options.map((option) => {
            const isPicked = option.key === picked;
            return (
              <ChipBody
                key={option.key}
                label={option.label}
                wash={isPicked ? withAlpha(m3.onSurface, 0.14) : undefined}
                ink={isPicked ? m3.onSurface : m3.onSurfaceVariant}
                accessibilityRole="tab"
                accessibilityState={{ selected: isPicked }}
                onPress={() => onPick(option.key)}
              />
            );
          })}
        </Animated.View>
      )}
      {folded && choice && (
        <Animated.View entering={appear} exiting={leave}>
          <ChipBody
            label={choice.label}
            ink={m3.onPrimary}
            accessibilityLabel={`${choice.label}. Choose another ${label.toLowerCase()}`}
            onPress={() => onExpandedChange(true)}
          />
        </Animated.View>
      )}
      {/* The outline, over the pill and taking no room — gone once folded,
          as a selected chip has no rim. */}
      <View
        pointerEvents="none"
        style={[
          styles.outline,
          {
            borderColor: folded ? withAlpha(m3.outlineVariant, 0) : m3.outlineVariant,
            transitionProperty: 'borderColor',
            transitionDuration: reduceMotion ? 0 : Motion.slow,
          },
        ]}
      />
    </Animated.View>
  );
}

/**
 * One chip's body — `ChipBody`: 32 high, 16 at each side, a full pill, the
 * label in `labelLarge`. `selected` pours `primary` in and turns the label
 * `onPrimary`; `outlined` draws the plain chip's own rim; `wash` and `ink`
 * are an option's look inside the open pill.
 */
function ChipBody({
  label,
  selected = false,
  outlined = false,
  wash,
  ink,
  expanded,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  onPress,
}: {
  label: string;
  selected?: boolean;
  outlined?: boolean;
  wash?: string;
  ink?: string;
  expanded?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'tab';
  accessibilityState?: { selected?: boolean };
  onPress: () => void;
}) {
  const theme = useTheme();
  const accent = useAccent();
  const { m3 } = accent;
  const reduceMotion = useReducedMotion();
  const color = ink ?? (selected ? m3.onPrimary : m3.onSurfaceVariant);

  return (
    <PressableScale
      accessibilityRole={outlined ? 'tab' : accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={
        outlined
          ? { selected }
          : (accessibilityState ?? (expanded === undefined ? undefined : { expanded }))
      }
      onPress={onPress}
      hitSlop={SmallControlSlop}
      scaleTo={0.95}
      pressedColor={selected ? accent.pressed : theme.pressed}
      focusRing={accent.ring}
      style={StyleSheet.flatten([
        styles.body,
        {
          backgroundColor: wash ?? 'transparent',
          borderColor: outlined ? (selected ? m3.primary : m3.outlineVariant) : 'transparent',
        },
      ])}>
      <PaintFill on={selected} color={m3.primary} />
      <Animated.Text numberOfLines={1} style={[Type.tab, { color }, inkTransition(reduceMotion)]}>
        {label}
      </Animated.Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  /* The pill every part of Mood stands in: it clips the poured fill, and grows
     and shrinks with what it holds. */
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  options: { flexDirection: 'row', alignItems: 'center' },
  outline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  /* `<TabBar>`'s chip: 32 drawn, 16 at the sides less the 1 of its edge. The
     edge is always there — transparent where it is not drawn — so every body
     is the same size whether or not it shows one. */
  body: {
    height: ControlHeight.small,
    paddingHorizontal: Spacing.x16 - 1,
    borderWidth: 1,
    borderRadius: Radius.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { GameCase, type GameCaseSize } from '@/components/game-case';
import { Poster } from '@/components/ui/poster';
import {
  hasCase,
  platformKeyFor,
  platformKeysFor,
  type PlatformKey,
} from '@/constants/platform-cases';
import { Elevation, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Case widths, mirrored so a cover can stand in at the same visual size. */
const COVER_WIDTHS: Record<GameCaseSize, number> = {
  small: 108,
  medium: 168,
  large: 232,
};

export type GameCaseDisplayProps = {
  coverUrl?: string | null;
  heroUrl?: string | null;
  title?: string | null;
  /** Every platform the game is on. Used only when `platform` is not given. */
  platforms?: string[] | null;
  /**
   * Which platform to present as. Controlled — the game page owns this so the
   * price and the store link change with the artwork.
   */
  platform?: PlatformKey;
  /** Fallback initial platform: the format the viewer logged, if any. */
  playedOn?: string | null;
  edition?: string | null;
  size?: GameCaseSize;
  width?: number;
  /** 3D turn on the case, in degrees. Ignored when the platform has no case. */
  tilt?: number;
};

/**
 * A game's artwork, presented the way that platform actually ships.
 *
 * Console gets the physical case. PC and mobile get the bare portrait cover,
 * because neither has had a box in years and rendering one is a costume rather
 * than a memory — a PC player has never held that object.
 *
 * The cover is not left naked: on a near-black page a 2:3 crop of dark key art
 * dissolves into the background, so it carries a hairline stroke and a soft
 * ambient shadow. Enough to seat it on the page, not enough to imitate the
 * case's physicality — the case has to stay the special one.
 */
export function GameCaseDisplay({
  coverUrl,
  heroUrl,
  title,
  platforms,
  platform,
  playedOn,
  edition,
  size = 'large',
  width,
  tilt,
}: GameCaseDisplayProps) {
  const theme = useTheme();

  const available = useMemo(() => platformKeysFor(platforms), [platforms]);

  /*
   * Uncontrolled fallback, for the screens that show artwork without a switcher
   * (a review masthead, the log form). Prefers the format the viewer owns.
   */
  const fallback = useMemo(() => {
    const played = playedOn ? platformKeyFor(playedOn) : null;
    return played && available.includes(played) ? played : available[0];
  }, [playedOn, available]);

  const active = platform ?? fallback;

  if (hasCase(active)) {
    return (
      <GameCase
        coverUrl={coverUrl}
        heroUrl={heroUrl}
        platform={active}
        title={title}
        edition={edition}
        size={size}
        width={width}
        {...(tilt === undefined ? {} : { tilt })}
      />
    );
  }

  const coverWidth = width ?? COVER_WIDTHS[size];

  return (
    /*
     * Its own height, which is the poster's — `width / PosterAspectRatio`.
     *
     * This carried `minHeight: caseHeightFor(coverWidth)` to stop the masthead
     * jumping when the platform switcher moved between a case and a cover. It
     * did not achieve that and could not: a case is 1.259× its width and a 2:3
     * poster is 1.5×, so the floor was 19% *shorter* than the thing standing on
     * it and the container grew past it anyway. What it did do was tell every
     * parent the wrong number — `<GameCaseFlip>` sized its fixed box from the
     * same function and the poster overflowed it onto the controls below.
     *
     * Switching platforms therefore does change the masthead's height now, by
     * design. That is the honest reading: a PS5 case and a PC cover are
     * different shapes, and pretending otherwise cost 36dp of overlap on the
     * platform buttons.
     */
    <View style={styles.cover}>
      <View style={[styles.frame, Elevation.card, { borderColor: theme.borderStrong }]}>
        <Poster
          coverUrl={coverUrl}
          heroUrl={heroUrl}
          title={title}
          width={coverWidth}
          rounded="caseImage"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { alignItems: 'center', justifyContent: 'center' },
  frame: {
    borderRadius: Radius.caseImage + 1,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 1,
    overflow: 'hidden',
  },
});

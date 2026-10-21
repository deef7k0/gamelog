import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import type { RevealLayout } from '@/components/surprise-reveal';
import { AnimatedCoverImage } from '@/components/ui/animated-cover-image';
import { Poster } from '@/components/ui/poster';
import { SQUARE_RADIUS, SquareArt } from '@/components/ui/square-art';
import { Skeleton } from '@/components/ui/surface';
import { Radius } from '@/constants/theme';
import { useAnimatedArtwork } from '@/hooks/use-animated-artwork';
import { useAnimatedCover, type AnimatedCover } from '@/hooks/use-animated-cover';
import { useSquareCover } from '@/hooks/use-square-cover';
import { useTheme } from '@/hooks/use-theme';
import type { GameSearchResult } from '@/lib/games/types';
import {
  SHAPE_PATIENCE_MS,
  chooseCardShape,
  type CardAnimation,
  type CardShape,
} from '@/lib/surprise-prefetch';

/**
 * The shape each game's card was first drawn in, for the session: a card
 * never changes shape under somebody's eyes, and dealing back to one draws it
 * as it was. Written once the card has been drawn (an effect), read as it is
 * drawn.
 */
const drawnShapes = new Map<string, CardShape>();

/** What a lookup has said: the animation, `null` for none, `undefined` for not yet. */
function answerOf(cover: AnimatedCover): CardAnimation | null | undefined {
  if (cover.status === 'found' && cover.animatedUrl && cover.format) {
    return {
      url: cover.animatedUrl,
      format: cover.format,
      quality: cover.quality ?? undefined,
      bytes: cover.bytes,
    };
  }
  return cover.status === 'loading' ? undefined : null;
}

/** The box the art was drawn in, for what is laid over it. */
export type CardArtBox = { width: number; height: number; radius: number };

export type SurpriseCardArtProps = {
  game: GameSearchResult;
  layout: RevealLayout;
  /** In front and settled: its animation may load and play. */
  load: boolean;
  /** A finger is on the deck: hold the animation on its frame. */
  paused: boolean;
  /** Drawn over the art, in its box — the card in front's "hidden" notice. */
  overlay?: (box: CardArtBox) => ReactNode;
};

/**
 * One dealt card's art: a square or a portrait, still or animated.
 *
 * Which, is `chooseCardShape` (`lib/surprise-prefetch.ts`): an animated
 * square, then an animated portrait — the owner's "allow for animated
 * portraits to show instead of only square" (2026-10-21) — then SteamGridDB's
 * still square, then the box. Nothing is drawn until the still square has an
 * answer, and with Animated artwork on the card waits up to
 * `SHAPE_PATIENCE_MS` for the animated answers too; the cards either side of
 * the one in front are mounted, so theirs are usually in before they are
 * dealt. Once drawn, a card keeps its shape for the session (`drawnShapes`).
 *
 * The still is always drawn first and the animation crossfades in over it —
 * only for the card in front, only once it has settled (`load`), held while a
 * finger is on the deck (`paused`), and dropped, its download with it, when
 * the card leaves.
 *
 * A square and a portrait are the same height (`revealLayout`), so nothing
 * under the card moves whichever it is.
 */
export function SurpriseCardArt({ game, layout, load, paused, overlay }: SurpriseCardArtProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const artwork = useAnimatedArtwork();
  const animated = artwork.on && !reduceMotion;

  const square = useSquareCover({ gameId: game.id, title: game.title });
  const animatedSquare = useAnimatedCover({ gameId: game.id, title: game.title, aspect: 'square' });
  const animatedPortrait = useAnimatedCover({
    gameId: game.id,
    title: game.title,
    aspect: 'portrait',
  });

  /* The animated answers are waited for this long, then the card is drawn as
     what is known. A timer's callback, not the effect, sets the state. */
  const [patience, setPatience] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setPatience(true), SHAPE_PATIENCE_MS);
    return () => clearTimeout(timer);
  }, []);

  const shape =
    drawnShapes.get(game.id) ??
    (artwork.ready
      ? chooseCardShape(
          {
            square: square.resolved ? square.uri : undefined,
            animatedSquare: answerOf(animatedSquare),
            animatedPortrait: answerOf(animatedPortrait),
          },
          { animated, patience }
        )
      : null);

  useEffect(() => {
    if (shape && !drawnShapes.has(game.id)) drawnShapes.set(game.id, shape);
  }, [shape, game.id]);

  if (!shape) {
    /* The answer is not in yet: a skeleton in the square's shape, never the
       box art — drawing that and then replacing it is the flicker this waits
       to prevent. */
    return (
      <Skeleton width={layout.squareWidth} height={layout.squareWidth} radius={SQUARE_RADIUS} />
    );
  }

  const box: CardArtBox =
    shape === 'square'
      ? { width: layout.squareWidth, height: layout.squareWidth, radius: SQUARE_RADIUS }
      : { width: layout.artWidth, height: layout.squareWidth, radius: Radius.image };

  return (
    <View style={{ width: box.width, height: box.height }}>
      {shape === 'square' ? (
        <SquareArt
          /* An animated square with no still one is rare; the box art stands
             in for the still, cropped, until the animation is up. */
          uri={square.uri ?? game.coverUrl ?? game.heroUrl ?? ''}
          size={layout.squareWidth}
          title={game.title}
          animation={animated ? animatedSquare : undefined}
          load={load}
          paused={paused}
        />
      ) : (
        <>
          <Poster
            coverUrl={game.coverUrl}
            heroUrl={game.heroUrl}
            title={game.title}
            width={layout.artWidth}
            steamAppId={game.steamAppId}
            edition={game.edition}
            elevated
          />
          {animated && animatedPortrait.status === 'found' && (
            /* The animation over the box, clipped to the box's corner. No still
               of its own: the box under it is the still. */
            <View style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: box.radius }]}>
              <AnimatedCoverImage
                staticUrl={null}
                animatedUrl={animatedPortrait.animatedUrl}
                format={animatedPortrait.format}
                status={animatedPortrait.status}
                onFailed={animatedPortrait.reportFailure}
                load={load}
                paused={paused}
                aspect="portrait"
                style={StyleSheet.absoluteFill}
                backdrop={theme.surfaceElevated}
              />
            </View>
          )}
        </>
      )}
      {overlay?.(box)}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});

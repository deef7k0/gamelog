import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { CdDisc } from '@/components/cd-disc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { CONDITION_LABEL, releaseLine } from '@/constants/physical';
import { platformKeyForStored } from '@/constants/platform-family';
import { withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CopyWithRelations } from '@/lib/api';
import { mix } from '@/lib/color';

/** Sleeves per page. Two, one above the other — the binder in the reference. */
export const SLEEVES_PER_PAGE = 2;

/** The inset between a page's edge and its sleeves, and between the sleeves. */
export const PAGE_PAD = 8;

/** A sleeve's padding around its disc, and the strip under it for the title. */
const SLEEVE_PAD = 8;
const CAPTION = 16;

/**
 * A page's geometry from its width — the disc, the sleeve and the page's height
 * all follow from it, so the binder can be sized from the screen alone.
 */
export function pageGeometry(pageWidth: number) {
  const sleeveWidth = pageWidth - PAGE_PAD * 2;
  const disc = sleeveWidth - SLEEVE_PAD * 2;
  const sleeveHeight = disc + SLEEVE_PAD + CAPTION + SLEEVE_PAD / 2;
  const height = sleeveHeight * SLEEVES_PER_PAGE + PAGE_PAD * (SLEEVES_PER_PAGE + 1);
  return { sleeveWidth, sleeveHeight, disc, height };
}

export type CdBinderPageProps = {
  /** This page's copies — up to two; a missing one is an empty sleeve. */
  copies: (CopyWithRelations | undefined)[];
  width: number;
  /** Which side of the spine, for the corner that meets it. */
  side: 'left' | 'right';
  onOpenCopy: (copy: CopyWithRelations) => void;
};

/**
 * One page of the binder: two clear sleeves, each holding a disc.
 *
 * The sleeve is film, not a card — a faint wash with a hairline edge, and a lip
 * of slightly heavier film across the lower part of the disc, where the pocket
 * closes over it in every binder like this. The disc sits flat in its pocket, so
 * it does not cast; the binder itself does.
 */
export function CdBinderPage({ copies, width, side, onOpenCopy }: CdBinderPageProps) {
  const theme = useTheme();
  const { sleeveWidth, sleeveHeight, disc, height } = pageGeometry(width);

  /* What shows through a disc's centre hole: the page, seen through the film. */
  const page = theme.surface;
  const film = mix(page, theme.text, 0.035);

  return (
    <View
      style={[
        styles.page,
        side === 'left' ? styles.leftPage : styles.rightPage,
        { width, height, padding: PAGE_PAD, gap: PAGE_PAD, backgroundColor: page },
      ]}>
      {Array.from({ length: SLEEVES_PER_PAGE }, (_, index) => {
        const copy = copies[index];
        return (
          <Sleeve
            key={copy?.id ?? `empty-${index}`}
            copy={copy}
            width={sleeveWidth}
            height={sleeveHeight}
            disc={disc}
            film={film}
            onOpen={onOpenCopy}
          />
        );
      })}
    </View>
  );
}

function Sleeve({
  copy,
  width,
  height,
  disc,
  film,
  onOpen,
}: {
  copy: CopyWithRelations | undefined;
  width: number;
  height: number;
  disc: number;
  film: string;
  onOpen: (copy: CopyWithRelations) => void;
}) {
  const theme = useTheme();
  const edge = withAlpha(theme.text, 0.09);
  /* The pocket's lip: from a little under the disc's middle to the bottom. */
  const lipTop = SLEEVE_PAD + disc * 0.62;

  const pocket = (
    <View style={[styles.sleeve, { width, height, backgroundColor: film, borderColor: edge }]}>
      {copy && (
        <CdDisc
          coverUrl={copy.game?.cover_url}
          heroUrl={copy.game?.hero_url}
          title={copy.game?.title ?? '?'}
          platform={platformKeyForStored(copy.platform)}
          size={disc}
          holeColor={film}
          style={styles.disc}
        />
      )}

      <LinearGradient
        colors={[withAlpha(theme.text, 0.1), withAlpha(theme.text, 0.04)]}
        style={[styles.lip, { top: lipTop, borderTopColor: withAlpha(theme.text, 0.18) }]}
        pointerEvents="none"
      />

      {copy && (
        <Text variant="caption" color="textSecondary" numberOfLines={1} style={styles.caption}>
          {copy.game?.title ?? 'A copy'}
        </Text>
      )}
    </View>
  );

  if (!copy) return pocket;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={[
        copy.game?.title ?? 'A copy',
        releaseLine(copy),
        copy.condition ? CONDITION_LABEL[copy.condition] : null,
      ]
        .filter(Boolean)
        .join(', ')}
      accessibilityHint="Opens this copy"
      onPress={() => onOpen(copy)}
      scaleTo={0.97}>
      {pocket}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  page: { overflow: 'hidden' },
  /* Rounded on the outside edge only; the spine side meets the other page. */
  leftPage: { borderTopLeftRadius: 12, borderBottomLeftRadius: 12 },
  rightPage: { borderTopRightRadius: 12, borderBottomRightRadius: 12 },
  sleeve: {
    alignItems: 'center',
    paddingTop: SLEEVE_PAD,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  disc: { position: 'relative' },
  lip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  caption: {
    position: 'absolute',
    left: SLEEVE_PAD,
    right: SLEEVE_PAD,
    bottom: SLEEVE_PAD / 2,
    height: CAPTION,
    textAlign: 'center',
  },
});

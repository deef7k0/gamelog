import { Image } from 'expo-image';
import { Linking, StyleSheet } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';

/*
 * SoundCloud's own files, as downloaded from developers.soundcloud.com and not
 * touched since: the white marks, for a dark ground. Each is drawn at half its
 * pixel size, so it is sharp at 2×.
 */
const MARKS = {
  /** The cloud and the word. 200×24. */
  logo: {
    source: require('@/assets/images/soundcloud/logo-big-white.png'),
    width: 100,
    height: 12,
  },
  /** "Powered by SoundCloud". 320×27. */
  poweredBy: {
    source: require('@/assets/images/soundcloud/powered-by-large-white.png'),
    width: 160,
    height: 13.5,
  },
} as const;

export type SoundCloudMarkProps = {
  variant?: keyof typeof MARKS;
  /**
   * Where the mark leads: the playlist's or the track's own page on
   * soundcloud.com. With one, the mark is a link; without, it is a credit.
   */
  url?: string | null;
  /** What a screen reader says the link opens — "Open Hades OST on SoundCloud". */
  label?: string;
};

/**
 * SoundCloud's logo, wherever something of SoundCloud's is shown or played.
 *
 * The API's terms ask for three things beside every track: the uploader's
 * name, SoundCloud credited as the source with one of its logos, and a link
 * back to the track on soundcloud.com. This is the second, and — given a
 * `url` — the third.
 *
 * **Never tint, recolour, crop or re-draw it.** It is the one image in the app
 * that is not this app's to restyle: the terms require the logo unmodified,
 * which is why there is no `color` prop and no `tintColor`, and why its two
 * sizes are fixed at the file's own proportions.
 */
export function SoundCloudMark({ variant = 'logo', url, label }: SoundCloudMarkProps) {
  const mark = MARKS[variant];

  const image = (
    <Image
      source={mark.source}
      style={{ width: mark.width, height: mark.height }}
      contentFit="contain"
      accessibilityIgnoresInvertColors
      accessible={!url}
      accessibilityLabel={url ? undefined : 'SoundCloud'}
    />
  );

  if (!url) return image;

  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={label ?? 'Open on SoundCloud'}
      onPress={() => openOnSoundCloud(url)}
      hitSlop={HIT_SLOP}
      scaleTo={0.96}
      style={styles.link}>
      {image}
    </PressableScale>
  );
}

/** Open a page on soundcloud.com — the app's, when it is installed. */
export function openOnSoundCloud(url: string | null | undefined) {
  if (!url) return;
  Linking.openURL(url).catch(() => {
    /* No browser and no app to hand it to. There is nothing to fall back on. */
  });
}

/* A 12dp-tall mark is a link, so it is touched at a finger's height. */
const HIT_SLOP = { top: 16, bottom: 16, left: 8, right: 8 };

const styles = StyleSheet.create({
  link: { alignSelf: 'flex-start' },
});

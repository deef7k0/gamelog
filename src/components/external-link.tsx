import { Href, Link } from 'expo-router';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Radius, Spacing, TapTarget } from '@/constants/theme';

type Props = Omit<ComponentProps<typeof Link>, 'href' | 'children' | 'style'> & {
  href: Href & string;
  children: ReactNode;
  /** Accessible name. Defaults to a generic one — pass the real destination. */
  label?: string;
  style?: ViewStyle;
};

/**
 * A link out of the app, into the in-app browser.
 *
 * ## Why this is a box and not a bare `<Link>`
 *
 * It used to render `expo-router`'s `<Link>` directly around whatever it was
 * given, which on the game page was one line of `h5`. That made the app's only
 * outbound store link **18dp tall** — the shortest target in the whole tree,
 * against a 44pt floor on iOS and 48dp on Android — and there was nowhere to
 * hang padding, because the thing being padded was a `Text`.
 *
 * Wrapping the child in a real pressable is what gives the link a *box* to have
 * a size at all. `asChild` hands `<Link>`'s press handling to that pressable, so
 * the routing behaviour is unchanged and the in-app browser still opens.
 *
 * `accessibilityRole="link"` comes with the box rather than after it: a bare
 * `<Link>` announced as ordinary prose, so a screen-reader user was told the
 * words but not that they could be activated. A pressable with a hit area and
 * no role would be the same omission with a bigger target.
 */
export function ExternalLink({ href, children, label, style, ...rest }: Props) {
  return (
    <Link
      target="_blank"
      {...rest}
      href={href}
      asChild
      onPress={async (event) => {
        if (process.env.EXPO_OS !== 'web') {
          // Prevent the default behavior of linking to the default browser on native.
          event.preventDefault();
          // Open the link in an in-app browser.
          await openBrowserAsync(href, {
            presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
          });
        }
      }}>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={label}
        scaleTo={0.98}
        style={StyleSheet.flatten([styles.link, style])}>
        {children}
      </PressableScale>
    </Link>
  );
}

const styles = StyleSheet.create({
  /* `flex-start` so the target hugs its label instead of spanning the column —
     a full-width invisible tap area over a short phrase catches presses meant
     for the page behind it. */
  link: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: TapTarget,
    paddingRight: Spacing.x8,
    borderRadius: Radius.control,
  },
});

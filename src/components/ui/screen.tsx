import { BlurTargetView } from 'expo-blur';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useHeaderHeight } from '@/hooks/use-header-height';
import { ScreenChromeProvider } from '@/hooks/use-screen-chrome';
import { useTheme } from '@/hooks/use-theme';

export type ScreenProps = {
  children: ReactNode;
  /** Which safe-area edges to inset. Tab screens usually want top only. */
  edges?: readonly Edge[];
  padded?: boolean;
  /**
   * Reserve the height of the floating stack header.
   *
   * The header is transparent app-wide, so it no longer pushes anything down.
   * Screens that open on artwork — a game, a collection, the Top 10 — want
   * exactly that and leave this off. Screens that open on a list, a form or a
   * grid would otherwise have their first row sitting under the back arrow, and
   * set it. Includes the status bar, so it replaces a `'top'` edge rather than
   * stacking with one.
   */
  insetHeader?: boolean;
  /**
   * Decoration painted behind the page, *outside* the safe-area inset.
   *
   * For an ambient glow or wash that has to reach the very top of the display
   * rather than stopping at the status bar. `children` cannot do this: the
   * safe-area padding is applied to the container they sit in, so even an
   * `absoluteFill` child starts below the notch — and a glow that stops on the
   * status-bar boundary draws exactly the hard horizontal line it was meant to
   * avoid.
   *
   * Whatever goes here must be inert. It is under the content and, on most
   * screens, under the status bar; nothing in it can be reached.
   */
  backdrop?: ReactNode;
  /**
   * The page's floating top bar — a `<FrostedTopBar>`.
   *
   * Its own slot rather than a child, and the reason is structural: the bar
   * blurs the page, so it has to be a *sibling* of the content it blurs and sit
   * outside the `<BlurTargetView>` below. A bar rendered as a child would be
   * inside its own blur source.
   *
   * It draws over the content and reserves no space, exactly like the native
   * header it replaces — screens that do not open on artwork pair it with
   * `insetHeader`.
   */
  topBar?: ReactNode;
  /**
   * This page is presented as a modal.
   *
   * Only affects where the top bar's content sits: an iOS sheet already starts
   * below the status bar and must not be inset again. Set it on the four modal
   * routes and nowhere else — `useTopBarInset` has the reasoning.
   */
  modal?: boolean;
};

/** Page shell: themed background, safe-area insets, centred max-width column. */
export function Screen({
  children,
  edges = ['top'],
  padded = false,
  insetHeader = false,
  backdrop,
  topBar,
  modal = false,
}: ScreenProps) {
  const theme = useTheme();
  const headerHeight = useHeaderHeight(modal);

  return (
    <ScreenChromeProvider modal={modal}>
      {({ blurTargetRef }) => (
        <View style={styles.flex}>
          {/*
            Everything the top bar is allowed to blur, and nothing else.

            On iOS and the web this is a plain `<View>` — those platforms sample
            whatever is behind a translucent layer without being told. On Android
            it is a native `BlurTarget`, the only thing `expo-blur` can read
            from; see `hooks/use-screen-chrome`. The bar is deliberately outside
            it.

            **The page fill lives here, not on the view above.** Android's blur
            renders this subtree and nothing else, so a background painted on an
            ancestor is not part of what the bar samples — on a screen with no
            `backdrop` the glass would come back with whatever the window's own
            drawable happens to be rather than `#121212`. It also keeps the
            backdrop over the fill and under the safe area, which is what
            `backdrop` is for; `SafeAreaView` stays transparent and does insets
            and nothing else.
          */}
          <BlurTargetView
            ref={blurTargetRef}
            style={[styles.flex, { backgroundColor: theme.background }]}>
            {backdrop}

            <SafeAreaView style={styles.flex} edges={edges}>
              <View
                style={[
                  styles.flex,
                  styles.column,
                  padded && styles.padded,
                  insetHeader && { paddingTop: headerHeight },
                ]}>
                {children}
              </View>
            </SafeAreaView>
          </BlurTargetView>

          {topBar}
        </View>
      )}
    </ScreenChromeProvider>
  );
}

export function LoadingState({ label }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={theme.primary} />
      {label && (
        <Text variant="bodySmall" color="textMuted" style={styles.centeredText}>
          {label}
        </Text>
      )}
    </View>
  );
}

export type EmptyStateProps = {
  title: string;
  message?: string;
  action?: ReactNode;
};

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <View style={styles.centered}>
      <Text variant="h3" style={styles.centeredText}>
        {title}
      </Text>
      {message && (
        <Text variant="body" color="textMuted" style={styles.centeredText}>
          {message}
        </Text>
      )}
      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
}

export function ErrorState({ error, action }: { error: unknown; action?: ReactNode }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return <EmptyState title="Could not load" message={message} action={action} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  padded: { paddingHorizontal: Spacing.x16 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.x24,
    gap: Spacing.x8,
  },
  centeredText: { textAlign: 'center' },
  action: { marginTop: Spacing.x12 },
});

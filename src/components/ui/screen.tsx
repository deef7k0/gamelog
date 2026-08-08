import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useHeaderHeight } from '@/hooks/use-header-height';
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
};

/** Page shell: themed background, safe-area insets, centred max-width column. */
export function Screen({
  children,
  edges = ['top'],
  padded = false,
  insetHeader = false,
}: ScreenProps) {
  const theme = useTheme();
  const headerHeight = useHeaderHeight();

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={edges}>
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
  );
}

export function LoadingState({ label }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={theme.primary} />
      {label && (
        <Text variant="caption" color="textMuted" style={styles.centeredText}>
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
      <Text variant="heading" style={styles.centeredText}>
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

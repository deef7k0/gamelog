import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { CopyShowcase } from '@/components/copy-showcase';
import { Button } from '@/components/ui/button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import {
  COMPLETENESS_HINT,
  CONDITION_HINT,
  CONDITION_LABEL,
  CONTRIBUTION_STATUS_LABEL,
  REGION_LABEL,
  completenessLabel,
  mediumFor,
  releaseLine,
} from '@/constants/physical';
import { hasCase } from '@/constants/platform-cases';
import { platformKeyForStored } from '@/constants/platform-family';
import { formatPartialDate } from '@/constants/progress';
import { Radius, Spacing } from '@/constants/theme';
import { AccentProvider, useAccent, useGameAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { deleteCopy, getCopy, type CopyWithRelations } from '@/lib/api';
import { maskBarcode } from '@/lib/barcode';
import { useAuth } from '@/store/auth';

/**
 * One physical copy, showcased.
 *
 * The binder holds the disc; this is the box it came out of. The case for its
 * platform leads (`<CopyShowcase>`): tap for the disc, drag to turn it over and
 * read what this copy is. Under it, the same facts as a list — the case's back is
 * the object's, set in type sized to a box, and this is the version to read. No
 * price, anywhere: condition describes a copy, it does not value it.
 *
 * A full screen on the game's own colour, like the game page — it is a screen
 * about one game, and the one where the case appears as a shelf object
 * (DESIGN.md § 4.1.2, "collection / shelf screens").
 */
export default function CopyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const copy = useQuery({
    queryKey: ['copy', id],
    queryFn: () => getCopy(id!),
    enabled: !!id,
  });

  const accent = useGameAccent(
    copy.data?.game?.cover_url ?? copy.data?.game?.hero_url,
    copy.data?.game?.genres
  );

  let body: React.ReactNode;
  if (copy.isLoading) body = <LoadingState />;
  else if (copy.isLoadingError)
    body = <ErrorState error={copy.error} onRetry={() => void copy.refetch()} />;
  else if (!copy.data)
    body = <EmptyState title="That copy is gone" message="It may have been deleted." />;
  else
    body = (
      <AccentProvider
        artwork={copy.data.game?.cover_url ?? copy.data.game?.hero_url}
        genres={copy.data.game?.genres}>
        <CopyDetail copy={copy.data} pageColor={accent.page} />
      </AccentProvider>
    );

  return (
    <Screen
      edges={['bottom']}
      insetHeader
      background={copy.data ? accent.page : undefined}
      topBar={<FrostedTopBar back />}>
      {body}
    </Screen>
  );
}

function CopyDetail({ copy, pageColor }: { copy: CopyWithRelations; pageColor: string }) {
  const theme = useTheme();
  const accent = useAccent();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const queryClient = useQueryClient();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;
  const isOwner = viewerId === copy.user_id;

  const platform = platformKeyForStored(copy.platform);
  const medium = mediumFor(platform);
  const barcode = copy.release?.barcodes[0]?.barcode ?? copy.contribution?.barcode ?? null;
  const waiting = !copy.release_id && copy.contribution?.status === 'pending';

  const remove = useMutation({
    mutationFn: () => deleteCopy(copy.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['copies', copy.user_id] });
      queryClient.invalidateQueries({ queryKey: ['user-game-stats', copy.user_id] });
      queryClient.removeQueries({ queryKey: ['copy', copy.id] });
      router.back();
    },
  });

  function confirmRemove() {
    Alert.alert(
      'Delete this copy?',
      `It comes off your shelf. ${copy.game?.title ?? 'The game'} itself, your log and any review stay as they are.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => remove.mutate() },
      ]
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.head}>
        {copy.game ? (
          <Link href={{ pathname: '/game/[id]', params: { id: copy.game.id } }} asChild>
            <PressableScale
              accessibilityRole="link"
              accessibilityLabel={`${copy.game.title}. Open the game page.`}
              scaleTo={0.98}
              style={StyleSheet.flatten(styles.titleRow)}>
              <Text variant="h1" numberOfLines={3} style={styles.flex}>
                {copy.game.title}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={accent.quietInk} />
            </PressableScale>
          </Link>
        ) : (
          <Text variant="h1">A copy</Text>
        )}
        <Text variant="body" style={{ color: accent.quietInk }}>
          {releaseLine(copy) || 'Release not recorded'}
        </Text>
      </View>

      <View style={styles.showcase}>
        <CopyShowcase copy={copy} width={width - Spacing.x16 * 2} pageColor={pageColor} />
        <Text variant="caption" style={[styles.hint, { color: accent.quietInk }]}>
          {platform && hasCase(platform)
            ? 'Tap the case for the disc. Drag it sideways to turn it over.'
            : 'Tap the art for the disc.'}
        </Text>
      </View>

      {waiting && copy.contribution && (
        <View style={[styles.notice, { borderColor: theme.border }]}>
          <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
          <Text variant="bodySmall" color="textSecondary" style={styles.flex}>
            {CONTRIBUTION_STATUS_LABEL.pending}. This copy links to the release by itself once its
            barcode is approved.
          </Text>
        </View>
      )}

      <View style={[styles.facts, { backgroundColor: accent.card }]}>
        {/* In full here, "Standard" included — the quick view drops it as
            noise, but this is where someone checks exactly which box it is. */}
        <Fact
          label="Release"
          value={
            copy.platform || copy.region
              ? [
                  copy.platform,
                  copy.region ? REGION_LABEL[copy.region] : null,
                  copy.edition?.trim() || 'Standard',
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'Not recorded'
          }
          hint={copy.release?.publisher ?? undefined}
        />
        <Fact
          label="Completeness"
          value={copy.completeness ? completenessLabel(copy.completeness, medium) : 'Not recorded'}
          hint={copy.completeness ? COMPLETENESS_HINT[copy.completeness] : undefined}
        />
        <Fact
          label="Condition"
          value={copy.condition ? CONDITION_LABEL[copy.condition] : 'Not recorded'}
          hint={copy.condition ? CONDITION_HINT[copy.condition] : undefined}
        />
        {barcode && (
          <Fact
            label="Barcode"
            value={maskBarcode(barcode)}
            /* Masked, not hidden: the last four are what anyone holding the box
               compares, and the whole string is the database's, not the owner's. */
            accessibilityValue={`ending ${barcode.slice(-4).split('').join(' ')}`}
          />
        )}
        {copy.acquired_on && <Fact label="Got it" value={formatPartialDate(copy.acquired_on)!} />}
        {copy.notes && <Fact label="Notes" value={`“${copy.notes}”`} />}
      </View>

      {remove.isError && (
        <Text variant="bodySmall" color="danger">
          {remove.error instanceof Error ? remove.error.message : 'Could not delete this copy.'}
        </Text>
      )}

      {isOwner && (
        <View style={styles.actions}>
          <Button
            title="Edit copy"
            icon="create-outline"
            variant="secondary"
            fullWidth
            onPress={() => router.push({ pathname: '/add-copy', params: { copy: copy.id } })}
          />
          <Button
            title="Delete copy"
            variant="danger"
            fullWidth
            loading={remove.isPending}
            onPress={confirmRemove}
          />
        </View>
      )}
    </ScrollView>
  );
}

function Fact({
  label,
  value,
  hint,
  accessibilityValue,
}: {
  label: string;
  value: string;
  hint?: string;
  accessibilityValue?: string;
}) {
  return (
    <View
      style={styles.fact}
      accessible
      accessibilityLabel={`${label}: ${accessibilityValue ?? value}${hint ? `. ${hint}` : ''}`}>
      <Text variant="label" color="textMuted">
        {label}
      </Text>
      <Text variant="body">{value}</Text>
      {hint && (
        <Text variant="caption" color="textMuted">
          {hint}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.x16, gap: Spacing.x24, paddingBottom: Spacing.x48 },
  head: { gap: Spacing.x4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  /* Room above for the case's landing and below for the disc's cast. */
  showcase: { gap: Spacing.x16, paddingVertical: Spacing.x12 },
  hint: { textAlign: 'center' },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.x8,
    padding: Spacing.x12,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  /* One surface holding the facts rather than a card each: they are one
     record, read top to bottom. */
  facts: { borderRadius: Radius.card, padding: Spacing.x16, gap: Spacing.x16 },
  fact: { gap: 2 },
  actions: { gap: Spacing.x8 },
});

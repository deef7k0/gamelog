import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { GameActions } from '@/components/game-actions';
import { GameCaseDisplay } from '@/components/game-case-display';
import { GameListItem } from '@/components/game-list-item';
import { CastRail, GamePosterRail } from '@/components/game-rail';
import { LogCard } from '@/components/log-card';
import { SoundtrackAlbums } from '@/components/soundtrack-section';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScorePill } from '@/components/ui/score';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Card, Chip, ScoreBadge, SectionHeader } from '@/components/ui/surface';
import { TabBar } from '@/components/ui/tab-bar';
import { Text } from '@/components/ui/text';
import { STATUS_LABEL } from '@/constants/status';
import { HeroAspectRatio, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getAchievementsForGame, getDiaryCount, getGameReviews, getMyLog } from '@/lib/api';
import { getGameById, getSimilarTo, parseGameId } from '@/lib/games';
import {
  getCollectionGames,
  getFranchiseGames,
  getGameCharacters,
  getGameExtras,
} from '@/lib/games/igdb';
import { useAuth } from '@/store/auth';

type GameTab = 'overview' | 'reviews' | 'soundtrack' | 'similar';

const TABS = [
  { key: 'overview' as const, label: 'Overview' },
  { key: 'reviews' as const, label: 'Reviews' },
  { key: 'soundtrack' as const, label: 'Soundtrack' },
  { key: 'similar' as const, label: 'Similar' },
];

/**
 * A game's dedicated page.
 *
 * The masthead — hero art, physical case, score, actions — stays fixed while
 * the tabs below swap content. Only the active tab's query runs, so opening the
 * page does not fetch reviews, soundtracks and recommendations it may never
 * show.
 */
export default function GameDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuth((state) => state.session?.user.id);
  const [tab, setTab] = useState<GameTab>('overview');

  const game = useQuery({
    queryKey: ['game', id],
    queryFn: ({ signal }) => getGameById(id!, signal),
    enabled: !!id,
    // Store metadata is effectively static; do not refetch during a session.
    staleTime: 30 * 60_000,
  });

  const myLog = useQuery({
    queryKey: ['my-log', userId, id],
    queryFn: () => getMyLog(userId!, id!),
    enabled: !!userId && !!id,
  });

  const reviews = useQuery({
    queryKey: ['game-reviews', id],
    queryFn: () => getGameReviews(id!),
    enabled: !!id && tab === 'reviews',
  });

  const similar = useQuery({
    queryKey: ['similar', id],
    queryFn: ({ signal }) => getSimilarTo(id!, signal),
    enabled: !!id && tab === 'similar',
    staleTime: 30 * 60_000,
  });

  const achievements = useQuery({
    queryKey: ['game-achievements', id, userId],
    queryFn: () => getAchievementsForGame(id!, userId ?? null),
    enabled: !!id && tab === 'overview',
  });

  /*
   * Franchise, studio and cast are IGDB-only: they key on IGDB ids that Steam,
   * RAWG and itch.io have no equivalent for. Gating on the source rather than
   * letting the queries fail keeps three guaranteed-empty requests off the wire
   * every time a Steam game is opened.
   */
  const parsedId = id ? parseGameId(id) : null;
  const igdbSourceId = parsedId?.source === 'igdb' ? parsedId.sourceId : null;

  const extras = useQuery({
    queryKey: ['game-extras', id],
    queryFn: ({ signal }) => getGameExtras(igdbSourceId!, signal),
    enabled: !!igdbSourceId && tab === 'overview',
    staleTime: 30 * 60_000,
  });

  const collectionId = extras.data?.collection?.id ?? null;
  const franchiseId = extras.data?.franchises[0]?.id ?? null;

  const franchiseGames = useQuery({
    queryKey: ['franchise-games', collectionId, franchiseId],
    queryFn: ({ signal }) =>
      collectionId
        ? getCollectionGames(collectionId, signal)
        : getFranchiseGames(franchiseId!, signal),
    enabled: collectionId !== null || franchiseId !== null,
    staleTime: 30 * 60_000,
  });

  const diaryCount = useQuery({
    queryKey: ['diary-count', userId, id],
    queryFn: () => getDiaryCount(userId!, id!),
    enabled: !!userId && !!id,
  });

  const cast = useQuery({
    queryKey: ['game-cast', id],
    queryFn: ({ signal }) => getGameCharacters(igdbSourceId!, signal),
    enabled: !!igdbSourceId && tab === 'overview',
    staleTime: 30 * 60_000,
  });

  if (game.isLoading) {
    return (
      <Screen edges={[]}>
        <LoadingState />
      </Screen>
    );
  }

  if (game.isError) {
    return (
      <Screen edges={[]}>
        <ErrorState
          error={game.error}
          action={<Button title="Retry" variant="secondary" onPress={() => game.refetch()} />}
        />
      </Screen>
    );
  }

  if (!game.data) {
    return (
      <Screen edges={[]}>
        <EmptyState title="Game not found" />
      </Screen>
    );
  }

  const data = game.data;
  const logged = myLog.data;
  const unlockedCount = (achievements.data ?? []).filter((entry) => entry.unlocked_at).length;
  const achievementTotal = achievements.data?.length ?? 0;

  /** The masthead, rendered above every tab. */
  const header = (
    <View style={styles.header}>
      <View style={styles.hero}>
        {data.heroUrl && (
          <Image
            source={{ uri: data.heroUrl }}
            style={styles.heroImage}
            contentFit="cover"
            transition={280}
            accessibilityIgnoresInvertColors
          />
        )}
        <LinearGradient
          colors={['transparent', theme.background]}
          style={styles.heroFade}
          pointerEvents="none"
        />
      </View>

      <View style={styles.identity}>
        <GameCaseDisplay
          coverUrl={data.coverUrl}
          heroUrl={data.heroUrl}
          title={data.title}
          platforms={data.platforms}
          playedOn={logged?.played_on}
          size="large"
        />

        <View style={styles.identityText}>
          <Text variant="title" numberOfLines={3} style={styles.centered}>
            {data.title}
          </Text>
          <Text variant="caption" color="textMuted" style={styles.centered}>
            {[data.releaseYear, data.developer].filter(Boolean).join(' · ')}
          </Text>
          {data.score !== null && (
            <View style={styles.scoreRow}>
              <ScoreBadge score={data.score} />
              <Text variant="micro" color="textMuted">
                COMMUNITY
              </Text>
            </View>
          )}
        </View>
      </View>

      {logged && (
        <Card elevation="none" style={{ backgroundColor: theme.primaryMuted }}>
          <View style={styles.myLog}>
            <View style={styles.myLogHead}>
              <Text variant="bodyStrong" color="primary">
                {STATUS_LABEL[logged.status]}
              </Text>
              {logged.platinum && <Ionicons name="trophy" size={16} color={theme.platinum} />}
            </View>
            {logged.rating !== null && <ScorePill score={logged.rating} size="large" showLabel />}
            {logged.review_title && <Text variant="bodyStrong">{logged.review_title}</Text>}
          </View>
        </Card>
      )}

      <GameActions game={data} log={logged ?? null} />

      {/* Diary. Sits below the log actions because it is a running record
          rather than a one-off action, and it is only offered to signed-in
          users — there is no diary to open without an account. */}
      {userId && (
        <Link
          href={{
            pathname: '/diary/[user]/[game]',
            params: { user: userId, game: data.id, tab: 'diary' },
          }}
          asChild>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Open your diary for this game"
            scaleTo={0.98}
            style={StyleSheet.flatten([styles.diaryButton, { backgroundColor: theme.surface }])}>
            <Ionicons name="book-outline" size={18} color={theme.primary} />
            <View style={styles.diaryText}>
              <Text variant="bodyStrong">Diary</Text>
              <Text variant="micro" color="textMuted">
                {diaryCount.data
                  ? `${diaryCount.data} ${diaryCount.data === 1 ? 'entry' : 'entries'}`
                  : 'Write about your playthrough'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </PressableScale>
        </Link>
      )}
    </View>
  );

  function renderTab() {
    switch (tab) {
      case 'reviews':
        if (reviews.isLoading) return <LoadingState />;
        if (reviews.isError) return <ErrorState error={reviews.error} />;
        return (
          <View style={styles.tabBody}>
            {(reviews.data ?? []).length === 0 ? (
              <EmptyState
                title="No reviews yet"
                message="Log this game with a score or review to be the first."
              />
            ) : (
              (reviews.data ?? []).map((log) => (
                <View key={log.id} style={styles.reviewRow}>
                  <LogCard log={log} />
                </View>
              ))
            )}
          </View>
        );

      case 'soundtrack':
        return (
          <View style={styles.tabBody}>
            <SoundtrackAlbums gameTitle={data.title} layout="grid" />
          </View>
        );

      case 'similar':
        if (similar.isLoading) return <LoadingState />;
        return (
          <View style={styles.tabBody}>
            {(similar.data ?? []).length === 0 ? (
              <EmptyState
                title="No recommendations"
                message={
                  data.source === 'igdb'
                    ? 'IGDB has no similar games listed for this title.'
                    : 'Similar games are only available for IGDB titles. Try opening this game from a search result instead.'
                }
              />
            ) : (
              (similar.data ?? []).map((entry) => (
                <View key={entry.id} style={styles.reviewRow}>
                  <GameListItem game={entry} />
                </View>
              ))
            )}
          </View>
        );

      default:
        return (
          <View style={styles.tabBody}>
            {data.platforms.length > 0 && (
              <View style={styles.chips}>
                {data.platforms.slice(0, 8).map((platform) => (
                  <Chip key={platform} label={platform} />
                ))}
              </View>
            )}

            {data.genres.length > 0 && (
              <View style={styles.chips}>
                {data.genres.slice(0, 6).map((genre) => (
                  <Chip key={genre} label={genre} tone="primary" />
                ))}
              </View>
            )}

            {data.description && (
              <View style={styles.section}>
                <SectionHeader title="About" />
                <Text variant="body" color="textSecondary">
                  {data.description}
                </Text>
              </View>
            )}

            {/* Studios. Tappable only for IGDB titles — company ids come from
                IGDB and Steam/RAWG/itch have no equivalent, so a Steam-sourced
                game shows the name as plain text rather than a dead link. */}
            {(extras.data?.companies.length ?? 0) > 0 && (
              <View style={styles.section}>
                <SectionHeader title="Studios" />
                <View style={styles.chips}>
                  {extras.data!.companies.map((company) => (
                    <Link
                      key={company.id}
                      href={{
                        pathname: '/studio/[id]',
                        params: { id: String(company.id), name: company.name },
                      }}
                      asChild>
                      <PressableScale
                        accessibilityRole="button"
                        accessibilityLabel={`${company.name} catalogue`}
                        scaleTo={0.95}
                        style={StyleSheet.flatten([
                          styles.studioChip,
                          { backgroundColor: theme.surface, borderColor: theme.border },
                        ])}>
                        <Text variant="caption">{company.name}</Text>
                        <Text variant="micro" color="textMuted">
                          {company.role === 'developer' ? 'Developer' : 'Publisher'}
                        </Text>
                        <Ionicons name="chevron-forward" size={13} color={theme.textMuted} />
                      </PressableScale>
                    </Link>
                  ))}
                </View>
              </View>
            )}

            {/* Franchise. IGDB models a numbered series as `collection` and the
                wider brand as `franchises`; the collection is the more useful of
                the two, so it wins when both exist. */}
            {franchiseGames.data && franchiseGames.data.length > 1 && (
              <View style={styles.section}>
                <SectionHeader
                  title={extras.data?.collection?.name ?? 'Franchise'}
                  action={
                    <Text variant="caption" color="textMuted">
                      {franchiseGames.data.length}
                    </Text>
                  }
                />
                <GamePosterRail
                  games={franchiseGames.data.filter((entry) => entry.id !== data.id)}
                />
              </View>
            )}

            {cast.data && cast.data.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="Cast" />
                <CastRail cast={cast.data} />
              </View>
            )}

            {data.screenshots.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="Screenshots" />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.shots}>
                  {data.screenshots.slice(0, 10).map((url) => (
                    <Image
                      key={url}
                      source={{ uri: url }}
                      style={[styles.shot, { backgroundColor: theme.surfaceElevated }]}
                      contentFit="cover"
                      transition={200}
                      accessibilityIgnoresInvertColors
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {achievementTotal > 0 && (
              <View style={styles.section}>
                <SectionHeader
                  title="Achievements"
                  action={
                    <Text variant="caption" color="textMuted">
                      {unlockedCount}/{achievementTotal}
                    </Text>
                  }
                />
                <PressableScale
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({ pathname: '/achievements/[id]', params: { id: data.id } })
                  }
                  scaleTo={0.98}
                  style={StyleSheet.flatten([styles.linkRow, { backgroundColor: theme.surface }])}>
                  <Text variant="bodyStrong">View all {achievementTotal}</Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                </PressableScale>
              </View>
            )}

            {data.storeUrl && (
              <ExternalLink href={data.storeUrl as Href & string}>
                <Text variant="bodyStrong" color="primary">
                  Open on {data.source === 'steam' ? 'Steam' : data.source.toUpperCase()}
                </Text>
              </ExternalLink>
            )}
          </View>
        );
    }
  }

  return (
    <Screen edges={[]}>
      {/* Transparency, the backdrop ramp and the shadow are all global now —
          see the root layout. Only the title is per-screen. */}
      <Stack.Screen options={{ title: data.title }} />

      {/* One FlatList with a single item: the tab bar has to scroll away with
          the masthead, and nesting a ScrollView inside a ScrollView would break
          that. The tab content itself is short enough not to need windowing. */}
      <FlatList
        data={[null]}
        keyExtractor={() => 'body'}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            {header}
            <TabBar tabs={TABS} value={tab} onChange={setTab} />
          </>
        }
        renderItem={() => renderTab()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  diaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radius.large,
  },
  diaryText: { flex: 1, gap: 1 },
  studioChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: { paddingBottom: Spacing.seven },
  header: { gap: Spacing.four, paddingHorizontal: Spacing.four, marginBottom: Spacing.four },
  hero: { marginHorizontal: -Spacing.four },
  heroImage: { width: '100%', aspectRatio: HeroAspectRatio },
  heroFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
  identity: { alignItems: 'center', gap: Spacing.four, marginTop: -Spacing.five },
  identityText: { alignSelf: 'stretch', gap: Spacing.one, alignItems: 'center' },
  centered: { textAlign: 'center' },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  myLog: { gap: Spacing.two },
  myLogHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tabBody: { padding: Spacing.four, gap: Spacing.four },
  reviewRow: { marginBottom: Spacing.three },
  section: { gap: Spacing.three },
  shots: { gap: Spacing.three, paddingRight: Spacing.four },
  shot: { width: 260, aspectRatio: HeroAspectRatio, borderRadius: Radius.medium },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.four,
    borderRadius: Radius.medium,
  },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link, Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { GameActions, formatReleaseDate } from '@/components/game-actions';
import { GamePrice, PlatformPicker } from '@/components/game-availability';
import { caseHeightFor } from '@/components/game-case';
import { GameCaseDisplay } from '@/components/game-case-display';
import { GameListItem } from '@/components/game-list-item';
import { CastRail, GamePosterRail } from '@/components/game-rail';
import { LogCard } from '@/components/log-card';
import { SoundtrackAlbums } from '@/components/soundtrack-section';
import { Button } from '@/components/ui/button';
import { HeroArt } from '@/components/ui/hero-art';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScorePill } from '@/components/ui/score';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Chip, ScoreBadge, SectionHeader } from '@/components/ui/surface';
import { TabBar } from '@/components/ui/tab-bar';
import { Text } from '@/components/ui/text';
import { platformKeysFor, type PlatformKey } from '@/constants/platform-cases';
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
 * The case, sized against the screen rather than a fixed width.
 *
 * 38% leaves the remaining ~55% of the column for the title, the price and the
 * platform buttons beside it. Everything on this page is a ratio of the window
 * for the same reason: the masthead is a *proportion* — art this wide, copy
 * that wide, this much overlap — and a fixed number would make the same
 * composition read as two different designs on a phone and a tablet.
 */
const CASE_WIDTH_RATIO = 0.38;
const CASE_MAX_WIDTH = 200;

/**
 * How far the case rises *into* the hero, as a fraction of its own height.
 *
 * Not "below the art, tucked under the fade" — the case genuinely overlaps it,
 * standing in front of the key art like a boxed copy propped against a poster.
 * Nearly half, so the overlap is unmistakably an overlap; at a third it read as
 * two stacked bands that happened to touch.
 */
const CASE_OVERLAP_RATIO = 0.46;

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
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuth((state) => state.session?.user.id);
  const [tab, setTab] = useState<GameTab>('overview');

  /*
   * One platform selection for the whole page.
   *
   * The artwork, the price and the store link are three views of the same
   * choice, so the choice lives here rather than inside any of them. `null`
   * means "not chosen yet" and defers to the game's own priority order, which
   * cannot be computed until the detail query resolves.
   */
  const [platform, setPlatform] = useState<PlatformKey | null>(null);

  const caseWidth = Math.min(CASE_MAX_WIDTH, Math.round(width * CASE_WIDTH_RATIO));
  // Also swallows the header's group gap, so the overlap is measured from the
  // hero's edge rather than from the gap below it.
  const caseOverlap = Math.round(caseHeightFor(caseWidth) * CASE_OVERLAP_RATIO) + Spacing.x24;

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

  // Resolved after the query, so the fallback knows what the game is actually on.
  const availablePlatforms = platformKeysFor(data.platforms);
  const activePlatform =
    platform && availablePlatforms.includes(platform) ? platform : availablePlatforms[0];
  const unlockedCount = (achievements.data ?? []).filter((entry) => entry.unlocked_at).length;
  const achievementTotal = achievements.data?.length ?? 0;

  /** The masthead, rendered above every tab. */
  const header = (
    <View style={styles.header}>
      <View style={styles.hero}>
        <HeroArt uri={data.heroUrl} scrim />
      </View>

      {/* Group 1 — identity, as one row: the boxed copy on the left standing in
          front of the key art, everything the game *is* set beside it. Stacked
          and centred, this block was two full screens before the first review;
          side by side it is one. */}
      <View style={[styles.identity, { marginTop: -caseOverlap }]}>
        <GameCaseDisplay
          coverUrl={data.coverUrl}
          heroUrl={data.heroUrl}
          title={data.title}
          platform={activePlatform}
          width={caseWidth}
        />

        <View style={styles.identityText}>
          <Text variant="title" numberOfLines={3}>
            {data.title}
          </Text>

          <GamePrice gameId={data.id} selected={activePlatform} />

          {data.releaseDate ? (
            <Text variant="caption" color="textMuted">
              {formatReleaseDate(data.releaseDate)}
            </Text>
          ) : data.releaseYear ? (
            <Text variant="caption" color="textMuted">
              {data.releaseYear}
            </Text>
          ) : null}

          {/* Developer and publisher are different facts and are frequently
              different companies, so they get a line each rather than being
              joined by a dot that implies one relationship. */}
          {data.developer && (
            <Text variant="micro" color="textMuted" numberOfLines={2}>
              {data.developer}
            </Text>
          )}
          {data.publisher && data.publisher !== data.developer && (
            <Text variant="micro" color="textMuted" numberOfLines={2}>
              {data.publisher}
            </Text>
          )}

          {data.score !== null && (
            <View style={styles.scoreRow}>
              <ScoreBadge score={data.score} size="small" />
              <Text variant="micro" color="textMuted">
                COMMUNITY
              </Text>
            </View>
          )}

          <PlatformPicker
            available={availablePlatforms}
            selected={activePlatform}
            onSelect={setPlatform}
          />
        </View>
      </View>

      {/* Group 2 — your record. What you already logged and how to change it
          are the same subject, so they sit in one tight group. The actions run
          the full width below both columns rather than being squeezed into the
          right one: they act on the game, not on its metadata. */}
      <View style={styles.record}>
        {/* Your own log — no surface behind it. It used to sit on a filled
            `tone="selected"` block, which made the one thing on this page that
            is *yours* look like a notice the app was showing you. The score and
            the status are already coloured; they do not need a box as well. */}
        {logged && (
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
        )}

        <GameActions game={data} log={logged ?? null} />
      </View>
    </View>
  );

  /*
   * The diary moved out of the masthead and into Overview.
   *
   * It was 85dp of chrome sitting between the primary action and the tab bar —
   * directly in the path to the reviews this screen exists to lead to — for a
   * feature PRODUCT.md explicitly does not rank among the differentiators. In
   * Overview it sits with the other per-game sections, which is where it
   * belonged: it is a record *about* this game, not an action on it.
   */
  const diaryRow = userId ? (
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
        style={StyleSheet.flatten([styles.diaryButton, { borderColor: theme.border }])}>
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
  ) : null;

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
            {diaryRow}

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
                  <Chip key={genre} label={genre} />
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
                          { borderColor: theme.border },
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
                  style={StyleSheet.flatten([styles.linkRow, { borderColor: theme.border }])}>
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
    gap: Spacing.x12,
    padding: Spacing.x16,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  diaryText: { flex: 1, gap: 1 },
  studioChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    paddingVertical: Spacing.x8,
    paddingHorizontal: Spacing.x12,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: { paddingBottom: Spacing.x48 },
  /*
   * `five` between groups, not `four` between every child.
   *
   * The masthead used one 16dp gap for all seven siblings, which is the failure
   * where a single repeated interval gives hero, identity, status, actions and
   * diary exactly equal weight. Three groups separated generously, tight
   * inside — the rhythm now says what belongs with what.
   */
  header: { gap: Spacing.x24, paddingHorizontal: Spacing.x16, marginBottom: Spacing.x24 },
  hero: { marginHorizontal: -Spacing.x16 },
  /* `marginTop` is supplied inline — it scales with the case.
     `flex-end` so the two columns share a baseline at the bottom: the case is a
     fixed shape and the copy is not, and aligning their tops would leave the
     title floating against nothing whenever a game has a short one. */
  identity: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.x16 },
  identityText: { flex: 1, gap: Spacing.x8, paddingBottom: Spacing.x4 },
  record: { gap: Spacing.x12 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.x8 },
  myLog: { gap: Spacing.x8 },
  myLogHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tabBody: { padding: Spacing.x16, gap: Spacing.x16 },
  reviewRow: { marginBottom: Spacing.x12 },
  section: { gap: Spacing.x12 },
  shots: { gap: Spacing.x12, paddingRight: Spacing.x16 },
  shot: { width: 260, aspectRatio: HeroAspectRatio, borderRadius: Radius.image },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.x16,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
});

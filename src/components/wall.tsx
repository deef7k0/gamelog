import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { postToWall, type ActivityEntry, type ActivityKind, type WallPost } from '@/lib/api';
import { displayNameFor, timeAgo } from '@/lib/format';

const MAX_LENGTH = 500;

/** Icon and tint per activity kind — the small marker on the left of each row. */
const ACTIVITY_ICON: Record<ActivityKind, keyof typeof Ionicons.glyphMap> = {
  reviewed: 'create',
  logged: 'game-controller',
  wishlisted: 'bookmark',
  listed: 'list',
  friended: 'people',
  platinum: 'trophy',
  watching_event: 'tv',
  attending_event: 'location',
  diary: 'book',
  commented: 'chatbubble',
};

/**
 * Kinds that carry writing, and therefore earn a preview and a bigger cover.
 *
 * A row saying "wishlisted X" has nothing to excerpt and shrinking it back to a
 * line is the point — the wall should make the things someone *wrote* look
 * different from the things they merely clicked.
 */
const WRITTEN_KINDS: readonly ActivityKind[] = ['reviewed', 'commented', 'diary'];

/** Poster width for a row with writing behind it, and for one without. */
const WRITTEN_POSTER = 54;
const PLAIN_POSTER = 30;

/**
 * Composer for a wall.
 *
 * Text only, deliberately — the wall is for short notes, and `posts` already
 * covers media. Non-friends are blocked by RLS rather than by hiding this, but
 * the caller decides whether to render it at all.
 */
export function WallComposer({
  wallOwnerId,
  authorId,
  isOwnWall,
}: {
  wallOwnerId: string;
  authorId: string;
  isOwnWall: boolean;
}) {
  const [body, setBody] = useState('');
  const queryClient = useQueryClient();

  const post = useMutation({
    mutationFn: () => postToWall(authorId, wallOwnerId, body),
    onSuccess: () => {
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['wall', wallOwnerId] });
    },
  });

  return (
    <View style={styles.composer}>
      <TextField
        value={body}
        onChangeText={setBody}
        placeholder={isOwnWall ? "What's on your mind?" : 'Write something…'}
        multiline
        maxLength={MAX_LENGTH}
        style={styles.composerInput}
        error={post.error instanceof Error ? post.error.message : null}
      />

      <View style={styles.composerFoot}>
        <Text variant="micro" color="textMuted">
          {body.trim().length}/{MAX_LENGTH}
        </Text>
        <Button
          title="Post"
          size="small"
          onPress={() => post.mutate()}
          loading={post.isPending}
          disabled={!body.trim()}
        />
      </View>
    </View>
  );
}

/** A written note on someone's wall. */
export function WallPostRow({ post }: { post: WallPost }) {
  const theme = useTheme();

  return (
    <View style={[styles.postCard, { borderTopColor: theme.border }]}>
      <Link href={{ pathname: '/profile/[id]', params: { id: post.author_id } }} asChild>
        <PressableScale accessibilityRole="button" scaleTo={0.99} style={styles.postHead}>
          <Avatar uri={post.author?.avatar_url} name={displayNameFor(post.author)} size={34} />
          <View style={styles.postHeadText}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {displayNameFor(post.author)}
            </Text>
            <Text variant="micro" color="textMuted">
              {timeAgo(post.created_at)}
            </Text>
          </View>
        </PressableScale>
      </Link>

      <Text variant="body" color="textSecondary">
        {post.body}
      </Text>
    </View>
  );
}

/**
 * One derived activity line — "reviewed X", "is now friends with Y".
 *
 * Rendered flatter and quieter than a wall post: these are automatic, and at
 * full card weight they would drown out the things people actually wrote.
 */
export function ActivityRow({
  entry,
  ownerName,
  ownerId,
}: {
  entry: ActivityEntry;
  ownerName: string;
  /** Whose wall this is. Diary rows need it to open the right person's diary. */
  ownerId?: string;
}) {
  const theme = useTheme();

  const tint = {
    reviewed: theme.primary,
    logged: theme.textSecondary,
    wishlisted: theme.primary,
    listed: theme.textSecondary,
    friended: theme.success,
    platinum: theme.platinum,
    watching_event: theme.accent,
    attending_event: theme.accent,
    diary: theme.primary,
    commented: theme.textSecondary,
  }[entry.kind];

  const written = WRITTEN_KINDS.includes(entry.kind) && !!entry.excerpt?.trim();

  function description() {
    switch (entry.kind) {
      case 'reviewed':
        return `reviewed ${entry.game?.title ?? 'a game'}`;
      case 'commented':
        return entry.targetAuthor
          ? `commented on ${entry.targetAuthor}'s review of ${entry.game?.title ?? 'a game'}`
          : `commented on a review of ${entry.game?.title ?? 'a game'}`;
      case 'platinum':
        return `platinumed ${entry.game?.title ?? 'a game'}`;
      case 'wishlisted':
        return `added ${entry.game?.title ?? 'a game'} to their wishlist`;
      case 'listed':
        return `added ${entry.game?.title ?? 'a game'} to ${entry.listTitle ?? 'a list'}`;
      case 'friended':
        return `is now friends with ${displayNameFor(entry.person)}`;
      case 'diary':
        return `added a new entry to ${entry.game?.title ?? 'a game'}'s diary`;
      case 'watching_event':
        return `will be watching ${entry.eventName ?? 'an event'}`;
      case 'attending_event':
        return `will be attending ${entry.eventName ?? 'an event'} in person`;
      default:
        return `logged ${entry.game?.title ?? 'a game'}`;
    }
  }

  const body = (
    <View style={[styles.activityRow, written && styles.activityRowWritten]}>
      <View style={[styles.activityIcon, { backgroundColor: `${tint}22` }]}>
        <Ionicons name={ACTIVITY_ICON[entry.kind]} size={14} color={tint} />
      </View>

      <View style={styles.activityText}>
        <Text variant="caption" numberOfLines={2}>
          <Text variant="caption" style={styles.strong}>
            {ownerName}
          </Text>{' '}
          {description()}
          {entry.score !== null ? ` · ${entry.score}/100` : ''}
        </Text>

        {/* The headline, when the writing has one. Quoted rather than styled as
            a title: at this size a second bold line would compete with the
            sentence above it for what the row is even about. */}
        {written && entry.reviewTitle && (
          <Text variant="caption" numberOfLines={1} style={styles.strong}>
            “{entry.reviewTitle}”
          </Text>
        )}

        {/* Two lines of what they actually said. `numberOfLines` truncates on
            the real rendered width and appends the ellipsis itself, so the cut
            lands mid-word exactly where the column ends — no guessing at a
            character count that would be wrong on every other screen size. */}
        {written && (
          <Text variant="caption" color="textMuted" numberOfLines={2} ellipsizeMode="tail">
            {entry.excerpt!.trim()}
          </Text>
        )}

        <Text variant="micro" color="textMuted">
          {timeAgo(entry.createdAt)}
        </Text>
      </View>

      {entry.game && (
        <Poster
          coverUrl={entry.game.cover_url}
          heroUrl={entry.game.hero_url}
          title={entry.game.title}
          width={written ? WRITTEN_POSTER : PLAIN_POSTER}
          rounded="xs"
        />
      )}
    </View>
  );

  // Friendship rows point at the other person; everything else at the game.
  if (entry.kind === 'friended' && entry.person) {
    return (
      <Link href={{ pathname: '/profile/[id]', params: { id: entry.person.id } }} asChild>
        <PressableScale accessibilityRole="button" scaleTo={0.99}>
          {body}
        </PressableScale>
      </Link>
    );
  }

  if (entry.game) {
    /*
     * A diary row points at the author's diary for that game, not at the shared
     * game page — the interesting thing is what *they* wrote, and the game page
     * has no notion of whose diary to show.
     */
    const href =
      entry.kind === 'diary' && entry.refId && ownerId
        ? ({
            pathname: '/diary/[user]/[game]',
            params: { user: ownerId, game: entry.refId, tab: 'diary' },
          } as const)
        : entry.kind === 'reviewed' && entry.refId
          ? ({ pathname: '/review/[id]', params: { id: entry.refId } } as const)
          : ({ pathname: '/game/[id]', params: { id: entry.game.id } } as const);

    return (
      <Link href={href} asChild>
        <PressableScale accessibilityRole="button" scaleTo={0.99}>
          {body}
        </PressableScale>
      </Link>
    );
  }

  return body;
}

const styles = StyleSheet.create({
  composer: { gap: Spacing.two },
  composerInput: { minHeight: 84 },
  composerFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  postCard: {
    paddingVertical: Spacing.three,
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  postHeadText: { flex: 1, gap: 1 },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  /* A row with writing in it is three or four lines tall, so its cover and icon
     hang from the top rather than floating in the vertical middle of a
     paragraph. */
  activityRowWritten: { alignItems: 'flex-start', paddingVertical: Spacing.three },
  activityIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityText: { flex: 1, gap: Spacing.one },
  strong: { fontFamily: FontFamily.semibold },
});

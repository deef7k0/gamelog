import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import {
  ARTICLE_TAGS,
  MAX_ARTICLE_LENGTH,
  MAX_POST_LENGTH,
  readingMinutes,
} from '@/constants/article-tags';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTheme } from '@/hooks/use-theme';
import { cacheGame, createPost, uploadImages } from '@/lib/api';
import { displayNameFor } from '@/lib/format';
import type { ArticleTag } from '@/lib/database.types';
import { getGameById, searchGames, type GameSearchResult } from '@/lib/games';
import { useAuth } from '@/store/auth';

type PostMode = 'post' | 'article';

const MAX_IMAGES = 6;
const THUMB = 96;

export default function CreatePostScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id);
  const profile = useAuth((state) => state.profile);

  const [mode, setMode] = useState<PostMode>('post');
  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<ArticleTag[]>([]);
  const [hasSpoilers, setHasSpoilers] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [taggedGame, setTaggedGame] = useState<GameSearchResult | null>(null);
  const [gameQuery, setGameQuery] = useState('');
  const [picking, setPicking] = useState(false);
  const debouncedQuery = useDebouncedValue(gameQuery.trim());

  const gameResults = useQuery({
    queryKey: ['search', 'games', debouncedQuery],
    queryFn: ({ signal }) => searchGames(debouncedQuery, signal),
    enabled: picking && debouncedQuery.length >= 2,
  });

  async function pickImages() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Photo access is needed to attach images.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImages((current) => [...current, ...result.assets.map((a) => a.uri)].slice(0, MAX_IMAGES));
    }
  }

  const pick = useMutation({ mutationFn: pickImages });

  const publish = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('You must be signed in.');
      if (!body.trim()) throw new Error('Write something first.');

      // Upload first: if this fails we do not want an orphaned post with no media.
      const mediaUrls = images.length > 0 ? await uploadImages(userId, images, 'posts') : [];

      // A tagged game must exist in the `games` cache before it can be
      // referenced — search results are not persisted automatically.
      let gameId: string | null = null;
      if (taggedGame) {
        const full = await getGameById(taggedGame.id);
        if (full) {
          await cacheGame(full);
          gameId = full.id;
        }
      }

      return createPost(userId, {
        body,
        mediaUrls,
        gameId,
        kind: mode === 'article' ? 'article' : 'post',
        title: mode === 'article' ? title : null,
        tags: mode === 'article' ? tags : [],
        hasSpoilers: mode === 'article' ? hasSpoilers : false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['user-posts', userId] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      setBody('');
      setTitle('');
      setTags([]);
      setHasSpoilers(false);
      setImages([]);
      setTaggedGame(null);
      router.push('/');
    },
  });

  const error = publish.error ?? pick.error;

  return (
    <Screen edges={[]} padded>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.authorRow}>
            <Avatar uri={profile?.avatar_url} name={displayNameFor(profile)} size={40} />
            <Text variant="h5">{displayNameFor(profile)}</Text>
          </View>

          {/* Post vs article. The two differ in more than length: an article
              gets a headline, tags and a spoiler flag, and is read on its own
              page rather than inline in the feed. */}
          <View style={styles.modes}>
            {(['post', 'article'] as const).map((option) => {
              const selected = mode === option;
              return (
                <PressableScale
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setMode(option)}
                  scaleTo={0.97}
                  style={StyleSheet.flatten([
                    styles.modeButton,
                    {
                      backgroundColor: selected ? theme.surfaceSelected : theme.surfaceElevated,
                      borderColor: selected ? theme.borderStrong : theme.border,
                    },
                  ])}>
                  <Ionicons
                    name={option === 'post' ? 'chatbox-outline' : 'newspaper-outline'}
                    size={17}
                    color={selected ? theme.text : theme.textMuted}
                  />
                  <View style={styles.modeText}>
                    <Text variant="bodySmall" color={selected ? 'text' : 'textSecondary'}>
                      {option === 'post' ? 'Post' : 'Article'}
                    </Text>
                    <Text variant="caption" color="textMuted">
                      {option === 'post' ? 'Short update' : 'Long-form piece'}
                    </Text>
                  </View>
                </PressableScale>
              );
            })}
          </View>

          {mode === 'article' && (
            <TextField
              value={title}
              onChangeText={setTitle}
              placeholder="Headline"
              maxLength={140}
              style={styles.headline}
            />
          )}

          <TextField
            value={body}
            onChangeText={setBody}
            placeholder={
              mode === 'article'
                ? 'Write your guide, theory or retrospective…'
                : 'What are you playing?'
            }
            multiline
            maxLength={mode === 'article' ? MAX_ARTICLE_LENGTH : MAX_POST_LENGTH}
            style={mode === 'article' ? styles.articleBody : styles.composer}
            hint={
              mode === 'article' && body.trim()
                ? `${body.trim().length.toLocaleString()} characters · ${readingMinutes(body)} min read`
                : undefined
            }
          />

          {mode === 'article' && (
            <>
              <View style={styles.section}>
                <Text variant="bodySmall" color="textSecondary">
                  Tags
                </Text>
                <View style={styles.tags}>
                  {ARTICLE_TAGS.map((tag) => {
                    const selected = tags.includes(tag.key);
                    return (
                      <PressableScale
                        key={tag.key}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() =>
                          setTags((current) =>
                            current.includes(tag.key)
                              ? current.filter((entry) => entry !== tag.key)
                              : [...current, tag.key]
                          )
                        }
                        scaleTo={0.93}
                        style={StyleSheet.flatten([
                          styles.tag,
                          {
                            backgroundColor: selected
                              ? theme.surfaceSelected
                              : theme.surfaceElevated,
                            borderColor: selected ? theme.borderStrong : theme.border,
                          },
                        ])}>
                        <Text variant="caption" color={selected ? 'text' : 'textMuted'}>
                          {tag.label}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>
              </View>

              <PressableScale
                accessibilityRole="switch"
                accessibilityState={{ checked: hasSpoilers }}
                onPress={() => setHasSpoilers((current) => !current)}
                scaleTo={0.98}
                style={StyleSheet.flatten([
                  styles.spoilerToggle,
                  {
                    backgroundColor: hasSpoilers ? theme.primaryMuted : 'transparent',
                    borderColor: hasSpoilers ? theme.accent : theme.border,
                  },
                ])}>
                <Ionicons
                  name={hasSpoilers ? 'eye-off' : 'eye-outline'}
                  size={18}
                  color={hasSpoilers ? theme.accent : theme.textMuted}
                />
                <View style={styles.modeText}>
                  <Text
                    variant="bodySmall"
                    style={{ color: hasSpoilers ? theme.accent : theme.text }}>
                    Contains spoilers
                  </Text>
                  <Text variant="caption" color="textMuted">
                    Blurs the body until readers opt in
                  </Text>
                </View>
              </PressableScale>
            </>
          )}

          {images.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbs}>
              {images.map((uri) => (
                <View key={uri} style={styles.thumbWrap}>
                  <Image
                    source={{ uri }}
                    style={[styles.thumb, { backgroundColor: theme.surfaceElevated }]}
                    contentFit="cover"
                    accessibilityIgnoresInvertColors
                  />
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel="Remove image"
                    onPress={() => setImages((current) => current.filter((u) => u !== uri))}
                    scaleTo={0.85}
                    style={StyleSheet.flatten([styles.remove, { backgroundColor: theme.scrim }])}>
                    <Ionicons name="close" size={14} color={theme.onPrimary} />
                  </PressableScale>
                </View>
              ))}
            </ScrollView>
          )}

          {taggedGame && (
            <View style={[styles.tagged, { borderColor: theme.border }]}>
              <Poster
                coverUrl={taggedGame.coverUrl}
                heroUrl={taggedGame.heroUrl}
                title={taggedGame.title}
                width={38}
                rounded="image"
              />
              <View style={styles.taggedText}>
                <Text variant="bodySmall" numberOfLines={1}>
                  {taggedGame.title}
                </Text>
                <Text variant="caption" color="textMuted">
                  {taggedGame.releaseYear ?? ''}
                </Text>
              </View>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Remove tagged game"
                onPress={() => setTaggedGame(null)}
                scaleTo={0.85}>
                <Ionicons name="close-circle" size={20} color={theme.textMuted} />
              </PressableScale>
            </View>
          )}

          <View style={styles.tools}>
            <Tool
              icon="images-outline"
              label={`Photos${images.length ? ` (${images.length})` : ''}`}
              disabled={images.length >= MAX_IMAGES}
              onPress={() => pick.mutate()}
            />
            <Tool
              icon="game-controller-outline"
              label={taggedGame ? 'Change game' : 'Tag a game'}
              onPress={() => setPicking((current) => !current)}
            />
          </View>

          {picking && (
            <View style={styles.picker}>
              <TextField
                value={gameQuery}
                onChangeText={setGameQuery}
                placeholder="Search a game to tag…"
                autoCapitalize="none"
                autoFocus
              />
              {/* A plain ScrollView, not a FlatList: this sits inside the
                  screen's outer ScrollView, and nesting two VirtualizedLists of
                  the same orientation breaks windowing (React Native warns
                  about it). The picker is a short, bounded dropdown, so it
                  gains nothing from virtualisation anyway. */}
              <ScrollView
                style={styles.pickerList}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled>
                {(gameResults.data ?? []).map((item) => (
                  <PressableScale
                    key={item.id}
                    accessibilityRole="button"
                    onPress={() => {
                      setTaggedGame(item);
                      setPicking(false);
                      setGameQuery('');
                    }}
                    scaleTo={0.98}
                    style={StyleSheet.flatten([
                      styles.pickerRow,
                      { borderTopColor: theme.border },
                    ])}>
                    <Poster
                      coverUrl={item.coverUrl}
                      heroUrl={item.heroUrl}
                      title={item.title}
                      width={34}
                      rounded="image"
                    />
                    <View style={styles.pickerText}>
                      <Text variant="bodySmall" numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text variant="caption" color="textMuted">
                        {[item.releaseYear, item.developer].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  </PressableScale>
                ))}

                {gameResults.data?.length === 0 &&
                  debouncedQuery.length >= 2 &&
                  !gameResults.isLoading && (
                    <Text variant="bodySmall" color="textMuted">
                      No games found.
                    </Text>
                  )}
              </ScrollView>
            </View>
          )}

          {error && (
            <Text variant="bodySmall" color="danger">
              {error instanceof Error ? error.message : 'Something went wrong.'}
            </Text>
          )}

          <Button
            title={
              publish.isPending && images.length > 0
                ? 'Uploading…'
                : mode === 'article'
                  ? 'Publish article'
                  : 'Post'
            }
            onPress={() => publish.mutate()}
            loading={publish.isPending}
            disabled={!body.trim() || (mode === 'article' && !title.trim())}
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Tool({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.96}
      style={StyleSheet.flatten([
        styles.tool,
        { borderColor: theme.border, opacity: disabled ? 0.5 : 1 },
      ])}>
      <Ionicons name={icon} size={18} color={theme.textSecondary} />
      <Text variant="bodySmall" color="textSecondary">
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: Spacing.x16, paddingVertical: Spacing.x16, paddingBottom: Spacing.x48 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  composer: { minHeight: 140 },
  headline: { ...Type.h2 },
  articleBody: { minHeight: 300 },
  modes: { flexDirection: 'row', gap: Spacing.x8 },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    padding: Spacing.x12,
    borderRadius: Radius.image,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modeText: { flex: 1, gap: 1 },
  section: { gap: Spacing.x8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.x8 },
  tag: {
    paddingVertical: Spacing.x8,
    paddingHorizontal: Spacing.x12,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  spoilerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    padding: Spacing.x12,
    borderRadius: Radius.image,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumbs: { gap: Spacing.x8 },
  thumbWrap: { position: 'relative' },
  thumb: { width: THUMB, height: THUMB, borderRadius: Radius.image },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* An attachment, so it keeps an edge: it has to look stuck *to* the post
     rather than being another paragraph of it. */
  tagged: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    padding: Spacing.x8,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  taggedText: { flex: 1, gap: 1 },
  tools: { flexDirection: 'row', gap: Spacing.x8, flexWrap: 'wrap' },
  tool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    paddingVertical: Spacing.x8,
    paddingHorizontal: Spacing.x12,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  picker: { gap: Spacing.x8 },
  pickerList: { maxHeight: 260 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingVertical: Spacing.x8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pickerText: { flex: 1, gap: 1 },
});

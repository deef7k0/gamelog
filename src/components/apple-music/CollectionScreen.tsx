/**
 * CollectionScreen.tsx
 *
 * Curated collection / playlist screen featuring the iOS 27 Apple Music hero transition.
 *
 * Layout Structure:
 *  - Fixed PageBackground gradient using collection keyColor
 *  - Sticky FrostedNavBar with fixed blur and 30% keyColor tint
 *  - HeroTransition with Skia progressive blur and color overlay
 *  - Content shelves:
 *      1. Editorial Highlight / Featured Track
 *      2. Complete Tracklist / Catalog items
 *      3. Featured Albums Carousel
 *      4. Related Collections Carousel
 *      5. Curator Credits & About
 */

import React, { useRef } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { BlurTargetView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';

import { PageBackground } from './PageBackground';
import { HeroTransition } from './HeroTransition';
import { FrostedNavBar } from './FrostedNavBar';
import { ContentShelf } from './ContentShelf';
import { useScrollProgress } from './useScrollProgress';

export type CollectionScreenProps = {
  keyColor?: string;
  bannerUri?: string;
  iconUri?: string;
  title?: string;
  curator?: string;
  itemCount?: number;
  duration?: string;
  onBackPress?: () => void;
};

const DEFAULT_BANNER =
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop';
const DEFAULT_ICON =
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=300&auto=format&fit=crop';

const TRACKS = [
  { id: '1', title: 'Neon Velocity', artist: 'Kavinsky & Daft Punk', duration: '3:45' },
  { id: '2', title: 'Midnight City Skyline', artist: 'M83', duration: '4:03' },
  { id: '3', title: 'Solar Pulse', artist: 'Jon Hopkins', duration: '5:12' },
  { id: '4', title: 'Synthetic Horizons', artist: 'Disasterpeace', duration: '3:20' },
  { id: '5', title: 'Ghost in the Machine', artist: 'Trent Reznor', duration: '4:38' },
  { id: '6', title: 'Quantum Echoes', artist: 'HEALTH', duration: '3:50' },
];

const RELATED_ALBUMS = [
  {
    title: 'Transistor OST',
    artist: 'Darren Korb',
    cover:
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop',
  },
  {
    title: 'Cyber Drift',
    artist: 'Scandroid',
    cover:
      'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?q=80&w=400&auto=format&fit=crop',
  },
  {
    title: 'Hollow Chords',
    artist: 'Christopher Larkin',
    cover:
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=400&auto=format&fit=crop',
  },
];

export function CollectionScreen({
  keyColor = '#241033',
  bannerUri = DEFAULT_BANNER,
  iconUri = DEFAULT_ICON,
  title = 'Neon Synths: Decade One',
  curator = 'GameLog Curators',
  itemCount = 32,
  duration = '2 hr 18 min',
  onBackPress,
}: CollectionScreenProps) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<View>(null);

  const heroHeight = Math.round(window.height * 0.5);
  const { scrollY, onScroll } = useScrollProgress(heroHeight);

  return (
    <View style={styles.container}>
      {/* 1. Underlying KeyColor Gradient Page Background */}
      <PageBackground keyColor={keyColor} />

      {/* 2. Sticky Frosted Glass Top Navigation Bar */}
      <FrostedNavBar
        title={title}
        subtitle={curator}
        avatarUri={iconUri}
        keyColor={keyColor}
        scrollY={scrollY}
        heroHeight={heroHeight}
        onBackPress={onBackPress}
        actionLabel="Play"
        actionIcon="play"
        blurTarget={blurTargetRef}
      />

      {/* 3. BlurTargetView for Android 12+ dimezisBlurViewSdk31Plus */}
      <BlurTargetView ref={blurTargetRef} style={StyleSheet.absoluteFill}>
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 40 },
          ]}>
          {/* Hero Transition Header with Skia Blur */}
          <HeroTransition
            imageUri={bannerUri}
            heroHeight={heroHeight}
            keyColor={keyColor}
            scrollY={scrollY}
            badge="CURATED PLAYLIST"
            title={title}
            subtitle={curator}
            metaText={`${itemCount} Songs · ${duration} · Updated Today`}
            onBackPress={onBackPress}
            actionButtons={
              <View style={styles.heroActionRow}>
                <Pressable style={styles.heroPlayButton}>
                  <Ionicons name="play" size={20} color="#000000" style={{ marginLeft: 2 }} />
                  <Text style={styles.heroPlayText}>Play All</Text>
                </Pressable>
                <Pressable style={styles.heroShuffleButton}>
                  <Ionicons name="shuffle" size={20} color="#FFFFFF" />
                </Pressable>
                <Pressable style={styles.heroShuffleButton}>
                  <Ionicons name="heart-outline" size={20} color="#FFFFFF" />
                </Pressable>
              </View>
            }
          />

          {/* Shelf 0: Featured Track Highlight */}
          <ContentShelf
            index={0}
            scrollY={scrollY}
            baseOffset={heroHeight * 0.3}
            title="Featured Track">
            <View style={styles.featuredCard}>
              <Ionicons name="sparkles" size={18} color="#F3C24B" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.featuredTitle}>Midnight City Skyline (2026 Remaster)</Text>
                <Text style={styles.featuredArtist}>M83 · Featured Lead Single</Text>
              </View>
              <Pressable style={styles.miniPlayBtn}>
                <Ionicons name="play" size={16} color="#000000" style={{ marginLeft: 2 }} />
              </Pressable>
            </View>
          </ContentShelf>

          {/* Shelf 1: Complete Tracklist */}
          <ContentShelf
            index={1}
            scrollY={scrollY}
            baseOffset={heroHeight * 0.3}
            title="Tracklist"
            actionText="Shuffle"
            onActionPress={() => {}}>
            <View style={styles.tracklistContainer}>
              {TRACKS.map((track, i) => (
                <Pressable key={track.id} style={styles.trackRow}>
                  <Text style={styles.trackIndex}>{i + 1}</Text>
                  <View style={styles.trackInfo}>
                    <Text style={styles.trackTitle} numberOfLines={1}>
                      {track.title}
                    </Text>
                    <Text style={styles.trackArtist} numberOfLines={1}>
                      {track.artist}
                    </Text>
                  </View>
                  <Text style={styles.trackDuration}>{track.duration}</Text>
                  <Pressable hitSlop={8} style={{ paddingLeft: 12 }}>
                    <Ionicons name="ellipsis-horizontal" size={18} color="rgba(255,255,255,0.4)" />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          </ContentShelf>

          {/* Shelf 2: Featured Albums in Collection */}
          <ContentShelf
            index={2}
            scrollY={scrollY}
            baseOffset={heroHeight * 0.3}
            title="Featured Soundtracks">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.albumCarousel}>
              {RELATED_ALBUMS.map((album, idx) => (
                <View key={idx} style={styles.albumCard}>
                  <Image source={{ uri: album.cover }} style={styles.albumCover} />
                  <Text style={styles.albumTitle} numberOfLines={1}>
                    {album.title}
                  </Text>
                  <Text style={styles.albumArtist} numberOfLines={1}>
                    {album.artist}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </ContentShelf>

          {/* Shelf 3: Curator Note */}
          <ContentShelf
            index={3}
            scrollY={scrollY}
            baseOffset={heroHeight * 0.3}
            title="Curator's Note">
            <View style={styles.curatorNoteBox}>
              <Text style={styles.curatorNoteText}>
                {
                  '"The defining soundscape of contemporary gaming. From analog synthesizer sweeps to orchestral electronic fusion, this compilation celebrates 10 years of iconic sound design."'
                }
              </Text>
              <Text style={styles.curatorSign}>— GameLog Audio Editorial Team</Text>
            </View>
          </ContentShelf>
        </Animated.ScrollView>
      </BlurTargetView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroPlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 24,
  },
  heroPlayText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000000',
  },
  heroShuffleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  featuredCard: {
    marginHorizontal: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  featuredTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  featuredArtist: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 2,
  },
  miniPlayBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tracklistContainer: {
    paddingHorizontal: 18,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  trackIndex: {
    width: 28,
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.4)',
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  trackArtist: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
  },
  trackDuration: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.45)',
  },
  albumCarousel: {
    paddingHorizontal: 18,
    gap: 14,
  },
  albumCard: {
    width: 140,
  },
  albumCover: {
    width: 140,
    height: 140,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  albumTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
  },
  albumArtist: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
  },
  curatorNoteBox: {
    marginHorizontal: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    padding: 16,
  },
  curatorNoteText: {
    fontSize: 14,
    lineHeight: 22,
    fontStyle: 'italic',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  curatorSign: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 10,
  },
});

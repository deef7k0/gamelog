/**
 * StudioScreen.tsx
 *
 * Studio / Artist profile screen matching the iOS 27 Apple Music artist profile page.
 *
 * Layout Structure:
 *  - Fixed PageBackground gradient using studio keyColor
 *  - Sticky FrostedNavBar with fixed blur and 30% keyColor tint
 *  - HeroTransition with Skia progressive blur and color overlay
 *  - Content shelves:
 *      1. Studio Bio & Identity
 *      2. Latest Release Spotlight
 *      3. Discography / Games Catalogue Carousel
 *      4. Key Creative Leadership
 *      5. Related Studios
 */

import React, { useRef, useState } from 'react';
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

export type StudioScreenProps = {
  keyColor?: string;
  bannerUri?: string;
  avatarUri?: string;
  name?: string;
  location?: string;
  followers?: string;
  onBackPress?: () => void;
};

const DEFAULT_BANNER =
  'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=1200&auto=format&fit=crop';
const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=300&auto=format&fit=crop';

const CATALOGUE = [
  {
    title: 'Hades II',
    year: '2025',
    rating: '98',
    cover:
      'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=400&auto=format&fit=crop',
  },
  {
    title: 'Hades',
    year: '2020',
    rating: '95',
    cover:
      'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=400&auto=format&fit=crop',
  },
  {
    title: 'Pyre',
    year: '2017',
    rating: '88',
    cover:
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=400&auto=format&fit=crop',
  },
  {
    title: 'Transistor',
    year: '2014',
    rating: '91',
    cover:
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop',
  },
];

const CREATORS = [
  {
    name: 'Amir Rao',
    role: 'Studio Director',
    avatar:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
  },
  {
    name: 'Greg Kasavin',
    role: 'Creative Director & Writer',
    avatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop',
  },
  {
    name: 'Darren Korb',
    role: 'Audio Director & Composer',
    avatar:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop',
  },
  {
    name: 'Jen Zee',
    role: 'Art Director',
    avatar:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop',
  },
];

export function StudioScreen({
  keyColor = '#2D1609',
  bannerUri = DEFAULT_BANNER,
  avatarUri = DEFAULT_AVATAR,
  name = 'Supergiant Games',
  location = 'San Francisco, CA',
  followers = '1.8M Followers',
  onBackPress,
}: StudioScreenProps) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<View>(null);
  const [following, setFollowing] = useState(false);

  const heroHeight = Math.round(window.height * 0.52);
  const { scrollY, onScroll } = useScrollProgress(heroHeight);

  return (
    <View style={styles.container}>
      {/* 1. Underlying KeyColor Gradient Page Background */}
      <PageBackground keyColor={keyColor} />

      {/* 2. Sticky Frosted Glass Top Navigation Bar */}
      <FrostedNavBar
        title={name}
        subtitle={location}
        avatarUri={avatarUri}
        keyColor={keyColor}
        scrollY={scrollY}
        heroHeight={heroHeight}
        onBackPress={onBackPress}
        actionLabel={following ? 'Following' : 'Follow'}
        actionIcon={following ? 'checkmark' : 'add'}
        onActionPress={() => setFollowing((f) => !f)}
        blurTarget={blurTargetRef}
      />

      {/* 3. Android BlurTargetView */}
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
            badge="INDEPENDENT STUDIO"
            title={name}
            subtitle={location}
            metaText={`${followers} · 6 Award-Winning Games`}
            onBackPress={onBackPress}
            actionButtons={
              <View style={styles.heroActionRow}>
                <Pressable
                  onPress={() => setFollowing((f) => !f)}
                  style={[styles.heroFollowBtn, following && styles.heroFollowBtnActive]}>
                  <Ionicons
                    name={following ? 'checkmark' : 'add'}
                    size={18}
                    color={following ? '#FFFFFF' : '#000000'}
                  />
                  <Text style={[styles.heroFollowText, following && styles.heroFollowTextActive]}>
                    {following ? 'Following' : 'Follow'}
                  </Text>
                </Pressable>
                <Pressable style={styles.heroShareBtn}>
                  <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
                </Pressable>
              </View>
            }
          />

          {/* Shelf 0: Studio Bio */}
          <ContentShelf index={0} scrollY={scrollY} baseOffset={heroHeight * 0.3} title="Biography">
            <View style={styles.bioBox}>
              <Text style={styles.bioText}>
                Founded in 2009, Supergiant Games is a small independent game development studio
                dedicated to crafting unforgettable experiences with striking visual design,
                reactive narration, and deeply intertwined original music.
              </Text>
            </View>
          </ContentShelf>

          {/* Shelf 1: Latest Release Spotlight */}
          <ContentShelf
            index={1}
            scrollY={scrollY}
            baseOffset={heroHeight * 0.3}
            title="Latest Release">
            <View style={styles.spotlightCard}>
              <Image source={{ uri: CATALOGUE[0].cover }} style={styles.spotlightCover} />
              <View style={styles.spotlightInfo}>
                <View style={styles.spotlightBadge}>
                  <Text style={styles.spotlightBadgeText}>NEW RELEASE</Text>
                </View>
                <Text style={styles.spotlightTitle}>{CATALOGUE[0].title}</Text>
                <Text style={styles.spotlightYear}>
                  {CATALOGUE[0].year} · Critical Acclaim ({CATALOGUE[0].rating}/100)
                </Text>
                <Pressable style={styles.spotlightPlayBtn}>
                  <Ionicons name="play" size={15} color="#000000" />
                  <Text style={styles.spotlightPlayText}>Play Game</Text>
                </Pressable>
              </View>
            </View>
          </ContentShelf>

          {/* Shelf 2: Complete Catalogue Carousel */}
          <ContentShelf
            index={2}
            scrollY={scrollY}
            baseOffset={heroHeight * 0.3}
            title="Discography & Games"
            actionText="See All"
            onActionPress={() => {}}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catalogueCarousel}>
              {CATALOGUE.map((item, idx) => (
                <View key={idx} style={styles.gameCard}>
                  <Image source={{ uri: item.cover }} style={styles.gameCover} />
                  <Text style={styles.gameTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.gameYear}>{item.year}</Text>
                </View>
              ))}
            </ScrollView>
          </ContentShelf>

          {/* Shelf 3: Key Creative Team */}
          <ContentShelf
            index={3}
            scrollY={scrollY}
            baseOffset={heroHeight * 0.3}
            title="Creative Team">
            <View style={styles.creativesList}>
              {CREATORS.map((c, idx) => (
                <View key={idx} style={styles.creatorRow}>
                  <Image source={{ uri: c.avatar }} style={styles.creatorAvatar} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.creatorName}>{c.name}</Text>
                    <Text style={styles.creatorRole}>{c.role}</Text>
                  </View>
                </View>
              ))}
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
  heroFollowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  heroFollowBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  heroFollowText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000000',
  },
  heroFollowTextActive: {
    color: '#FFFFFF',
  },
  heroShareBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  bioBox: {
    paddingHorizontal: 18,
  },
  bioText: {
    fontSize: 15,
    lineHeight: 23,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  spotlightCard: {
    marginHorizontal: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  spotlightCover: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  spotlightInfo: {
    flex: 1,
    gap: 4,
  },
  spotlightBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(243, 194, 75, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  spotlightBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F3C24B',
  },
  spotlightTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  spotlightYear: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  spotlightPlayBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginTop: 4,
  },
  spotlightPlayText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  catalogueCarousel: {
    paddingHorizontal: 18,
    gap: 14,
  },
  gameCard: {
    width: 140,
  },
  gameCover: {
    width: 140,
    height: 180,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  gameTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
  },
  gameYear: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.55)',
    marginTop: 2,
  },
  creativesList: {
    marginHorizontal: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    paddingVertical: 8,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  creatorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  creatorName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  creatorRole: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
  },
});

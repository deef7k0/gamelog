/**
 * GamePageScreen.tsx
 *
 * Full-bleed game presentation screen with iOS 27 Apple Music-style hero transition.
 *
 * Layout Structure:
 *  - Fixed PageBackground vertical gradient driven by keyColor
 *  - Sticky FrostedNavBar pinned to top with BlurView + 30% keyColor tint
 *  - HeroTransition with Skia progressive blur, scale, and color overlay
 *  - Content shelves with staggered fade-in + slide-up on scroll:
 *      1. Download CTA & Quick Stats
 *      2. Synopsis & Game Overview
 *      3. High-res Screenshots Carousel
 *      4. Critic & Community Reviews
 *      5. Specifications & Details
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

export type GamePageScreenProps = {
  /** Dominant key color extracted from the key art (default: deep sapphire) */
  keyColor?: string;
  /** Hero image banner URL */
  bannerUri?: string;
  /** Thumbnail avatar URL for the sticky nav bar */
  iconUri?: string;
  /** Game Title */
  title?: string;
  /** Developer / Studio name */
  developer?: string;
  /** User or Metacritic rating */
  score?: number;
  /** On press back */
  onBackPress?: () => void;
};

const DEFAULT_BANNER =
  'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200&auto=format&fit=crop';
const DEFAULT_ICON =
  'https://images.unsplash.com/photo-1612287233215-68a8677c3e53?q=80&w=300&auto=format&fit=crop';

const SCREENSHOTS = [
  'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1579373903781-fd5c0c30c4cd?q=80&w=800&auto=format&fit=crop',
];

export function GamePageScreen({
  keyColor = '#0F2642',
  bannerUri = DEFAULT_BANNER,
  iconUri = DEFAULT_ICON,
  title = 'Chrono Nexus: Origins',
  developer = 'Aetheria Interactive',
  score = 96,
  onBackPress,
}: GamePageScreenProps) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<View>(null);

  const heroHeight = Math.round(window.height * 0.52);
  const { scrollY, onScroll } = useScrollProgress(heroHeight);

  return (
    <View style={styles.container}>
      {/* 1. Underlying KeyColor Gradient Page Background */}
      <PageBackground keyColor={keyColor} />

      {/* 2. Sticky Frosted Glass Top Navigation Bar */}
      <FrostedNavBar
        title={title}
        subtitle={developer}
        avatarUri={iconUri}
        keyColor={keyColor}
        scrollY={scrollY}
        heroHeight={heroHeight}
        onBackPress={onBackPress}
        actionLabel="GET"
        actionIcon="cloud-download-outline"
        blurTarget={blurTargetRef}
      />

      {/* 3. Android BlurTargetView Wrapping the Scrollable Content */}
      <BlurTargetView ref={blurTargetRef} style={StyleSheet.absoluteFill}>
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 40 },
          ]}>
          {/* Hero Transition Header with Skia Blur & Color Overlay */}
          <HeroTransition
            imageUri={bannerUri}
            heroHeight={heroHeight}
            keyColor={keyColor}
            scrollY={scrollY}
            badge="EDITOR'S CHOICE"
            title={title}
            subtitle={developer}
            metaText={`${score}/100 Rating · Action / Sci-Fi RPG`}
            onBackPress={onBackPress}
            actionButtons={
              <View style={styles.heroActionRow}>
                <Pressable style={styles.heroGetButton}>
                  <Ionicons name="download-outline" size={18} color="#000000" />
                  <Text style={styles.heroGetText}>Install Now</Text>
                </Pressable>
                <Pressable style={styles.heroWishlistButton}>
                  <Ionicons name="bookmark-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.heroWishlistText}>Wishlist</Text>
                </Pressable>
              </View>
            }
          />

          {/* Shelf 0: Download CTA & Quick Stats */}
          <ContentShelf index={0} scrollY={scrollY} baseOffset={heroHeight * 0.3}>
            <View style={styles.statsCard}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>4.9 ★</Text>
                <Text style={styles.statLabel}>128K Ratings</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>#1</Text>
                <Text style={styles.statLabel}>Action RPG</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>16+</Text>
                <Text style={styles.statLabel}>Age Rating</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>48 GB</Text>
                <Text style={styles.statLabel}>Storage</Text>
              </View>
            </View>
          </ContentShelf>

          {/* Shelf 1: Description & Overview */}
          <ContentShelf
            index={1}
            scrollY={scrollY}
            baseOffset={heroHeight * 0.3}
            title="About the Game">
            <View style={styles.descriptionBox}>
              <Text style={styles.descriptionText}>
                Step into the shattered timeline of Chrono Nexus. Harness lost temporal technology,
                engage in seamless real-time combat, and rewrite the fate of a sprawling cyberpunk
                metropolis under the shadow of dying stars.
              </Text>
              <View style={styles.tagRow}>
                {['Single-Player', 'Cross-Save', 'DualSense Support', 'HDR10'].map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          </ContentShelf>

          {/* Shelf 2: Screenshots & Media Carousel */}
          <ContentShelf
            index={2}
            scrollY={scrollY}
            baseOffset={heroHeight * 0.3}
            title="Screenshots & Media"
            actionText="See All"
            onActionPress={() => {}}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContainer}>
              {SCREENSHOTS.map((uri, idx) => (
                <View key={idx} style={styles.screenshotCard}>
                  <Image source={{ uri }} style={styles.screenshotImage} resizeMode="cover" />
                </View>
              ))}
            </ScrollView>
          </ContentShelf>

          {/* Shelf 3: Community & Critic Reviews */}
          <ContentShelf
            index={3}
            scrollY={scrollY}
            baseOffset={heroHeight * 0.3}
            title="Reviews & Accolades"
            actionText="All 4.2k"
            onActionPress={() => {}}>
            <View style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewerName}>IGN Entertainment</Text>
                <View style={styles.scorePill}>
                  <Text style={styles.scorePillText}>9.5 / 10</Text>
                </View>
              </View>
              <Text style={styles.reviewQuote}>
                {
                  '"A visual and technical marvel. Chrono Nexus sets a new benchmark for mobile and cross-platform action RPGs."'
                }
              </Text>
            </View>
          </ContentShelf>

          {/* Shelf 4: Specifications & Details */}
          <ContentShelf
            index={4}
            scrollY={scrollY}
            baseOffset={heroHeight * 0.3}
            title="Information">
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>Developer</Text>
                <Text style={styles.infoVal}>{developer}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>Languages</Text>
                <Text style={styles.infoVal}>English, Japanese, Spanish +12</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>Game Engine</Text>
                <Text style={styles.infoVal}>Unreal Engine 5.5</Text>
              </View>
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
  heroGetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  heroGetText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000000',
  },
  heroWishlistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 24,
  },
  heroWishlistText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statsCard: {
    marginHorizontal: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  descriptionBox: {
    paddingHorizontal: 18,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 23,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  tag: {
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.75)',
  },
  carouselContainer: {
    paddingHorizontal: 18,
    gap: 12,
  },
  screenshotCard: {
    width: 260,
    height: 150,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  screenshotImage: {
    width: '100%',
    height: '100%',
  },
  reviewCard: {
    marginHorizontal: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scorePill: {
    backgroundColor: 'rgba(74, 222, 128, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  scorePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4ADE80',
  },
  reviewQuote: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  infoCard: {
    marginHorizontal: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoKey: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.55)',
  },
  infoVal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

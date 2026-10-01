import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { GamePrice } from '@/components/game-availability';
import { caseHeightFor } from '@/components/game-case';
import { GameCaseFlip } from '@/components/game-case-flip';
import { DropdownButton, type DropdownOption } from '@/components/ui/dropdown-button';
import { Section, useSectionInset, useSectionMetrics } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { editionLabel } from '@/constants/game-editions';
import { PLATFORMS, hasCase, type PlatformKey } from '@/constants/platform-cases';
import { PosterAspectRatio, Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import type { GameLog } from '@/lib/database.types';
import type { Game } from '@/lib/games';

/**
 * The protected case, memoised from the outside — its props are the game's own
 * fields, the selection and the log, so a page update that changes none of them
 * does not re-render the object and its animated transform.
 */
const CaseFlip = memo(GameCaseFlip);

/** How many platforms the sentence names before it counts the rest. */
const NAMED = 3;

/**
 * `PLATFORMS` calls both Xboxes "Xbox", which is right on a log's printed back
 * and ambiguous in a list holding both. `platform-cases.ts` is protected, so
 * the distinction is made here.
 */
const NAME_OVERRIDES: Partial<Record<PlatformKey, string>> = { xboxOriginal: 'Original Xbox' };

function nameOf(key: PlatformKey): string {
  return NAME_OVERRIDES[key] ?? PLATFORMS[key].label;
}

/**
 * "is available on PlayStation 5, Xbox, PC and 2 more" — the line under the
 * title, continuing it.
 *
 * Full names, because this is a sentence; the button under it carries the short
 * form. `other` is never named — it stands for every platform the app has no
 * name for, so it is counted in "more" instead.
 */
export function availabilityLine(keys: readonly PlatformKey[]): string {
  const named = keys.filter((key) => key !== 'other').map(nameOf);
  const shown = named.slice(0, NAMED);
  const more = named.length - shown.length + (keys.includes('other') ? 1 : 0);
  if (shown.length === 0) return 'is available on a system not listed here';

  const parts = more > 0 ? [...shown, `${more} more`] : shown;
  const last = parts[parts.length - 1];
  return parts.length === 1
    ? `is available on ${last}`
    : `is available on ${parts.slice(0, -1).join(', ')} and ${last}`;
}

export type GamePlatformsProps = {
  game: Game;
  log: GameLog | null;
  /** Every platform the game is on, in `PLATFORM_PRIORITY` order. */
  platforms: readonly PlatformKey[];
  selected: PlatformKey;
  onSelect: (platform: PlatformKey) => void;
  /** The object's width: the page's case width, so it is the masthead's size. */
  artWidth: number;
};

/**
 * Which machines a game is on, and the box it comes in on each.
 *
 * A section of the Overview, on the page and not in a card: the object on the
 * left, and beside it the game's name continuing into a sentence about where it
 * is available, the platform button, and what it costs there. Choosing a
 * platform re-draws the box — a console case for PS5, PS4, Xbox and Switch, the
 * plain cover for everything else (DESIGN.md § 4.1.3) — and re-prices it.
 *
 * **This is where the case lives now.** The masthead always shows the plain
 * cover, and the turn-over came here with the case: tap or drag the box and it
 * shows your record on its back. A plain cover has no back, so it does not turn.
 *
 * **The slot is the height of the tallest shape this game can show**, with the
 * object standing at its foot, as boxes of different heights stand on one
 * shelf. A case is 1.26× its width and a plain cover 1.5×, so without the
 * reservation switching PS5 → PC would push everything under the section down
 * by a fifth of the box.
 */
export function GamePlatforms({
  game,
  log,
  platforms,
  selected,
  onSelect,
  artWidth,
}: GamePlatformsProps) {
  const accent = useAccent();
  const inset = useSectionInset();
  const metrics = useSectionMetrics();

  if (platforms.length === 0) return null;

  const slotHeight = platforms.some((key) => !hasCase(key))
    ? artWidth / PosterAspectRatio
    : caseHeightFor(artWidth);

  const options: DropdownOption<PlatformKey>[] = platforms.map((key) => ({
    value: key,
    label: nameOf(key),
    short: PLATFORMS[key].short,
    icon: PLATFORMS[key].icon,
  }));

  const line = availabilityLine(platforms);

  return (
    <Section title="Platforms">
      <View
        style={[
          styles.row,
          { paddingHorizontal: inset, paddingTop: metrics.artTop, paddingBottom: Spacing.x8 },
        ]}>
        <View style={[styles.slot, { width: artWidth, height: slotHeight }]}>
          <CaseFlip
            coverUrl={game.coverUrl}
            heroUrl={game.heroUrl}
            title={game.title}
            edition={game.edition ? editionLabel(game.edition) : null}
            platform={selected}
            width={artWidth}
            log={log}
          />
        </View>

        <View style={styles.column}>
          {/* One sentence to a screen reader, as it reads on the page. */}
          <View accessible accessibilityLabel={`${game.title} ${line}`} style={styles.claim}>
            <Text variant="h3" numberOfLines={2}>
              {game.title}
            </Text>
            <Text variant="body" style={{ color: accent.quietInk }}>
              {line}
            </Text>
          </View>

          <View style={styles.controls}>
            <DropdownButton
              label="Platform"
              value={selected}
              options={options}
              onChange={onSelect}
            />
            <GamePrice
              gameId={game.id}
              selected={selected}
              title={game.title}
              steamAppId={game.steamAppId}
            />
          </View>
        </View>
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  /* Top-aligned, as the masthead's identity row is: the box is the fixed shape,
     and the words start level with the top of the tallest box it can be. */
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.x16 },
  slot: { justifyContent: 'flex-end' },
  column: { flex: 1, gap: Spacing.x16 },
  /* The name and the sentence it runs into are one statement, so they sit
     closer to each other than to the control under them. */
  claim: { gap: Spacing.x4 },
  controls: { gap: Spacing.x12 },
});

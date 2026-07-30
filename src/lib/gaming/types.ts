/**
 * Generic gaming-account provider contracts.
 *
 * Steam is one implementation of this, not the shape of it. Everything the UI
 * consumes is a provider-neutral domain type; nothing above this layer knows
 * what a SteamID64 is, that `playtime_forever` is measured in minutes, or that
 * inventories come from an undocumented community endpoint.
 *
 * ## Adding a provider
 *
 * 1. Add its id to `GAMING_PROVIDER_IDS` here, and to `gaming_providers()` in
 *    migration 0009.
 * 2. Implement `GamingAccountProvider` and declare its `capabilities`.
 * 3. Register it in `registry.ts`.
 *
 * That is the whole list. The UI renders from `capabilities`, so a provider with
 * no inventory concept simply omits the section — it does not implement a method
 * that throws, and no screen needs a provider check.
 */

export const GAMING_PROVIDER_IDS = [
  'steam',
  'xbox',
  'playstation',
  'epic',
  'gog',
  'battlenet',
  'riot',
  'ubisoft',
] as const;

export type GamingProviderId = (typeof GAMING_PROVIDER_IDS)[number];

/**
 * The independently syncable units of a linked account.
 *
 * Sections exist because their costs differ by orders of magnitude: `profile` is
 * one request, `achievements` is two requests *per owned game*. Tying them
 * together would mean either refreshing the cheap data far too rarely or the
 * expensive data far too often.
 */
export const SYNC_SECTIONS = [
  'profile',
  'library',
  'achievements',
  'inventory',
  'badges',
  'friends',
] as const;

export type SyncSection = (typeof SYNC_SECTIONS)[number];

/**
 * What a provider can actually do.
 *
 * Honesty here is what keeps the UI truthful. `purchaseDates: false` for Steam
 * is why the library does not offer a "recently purchased" sort — the Steam Web
 * API exposes no purchase date anywhere, and a sort that silently fell back to
 * "last played" would be a lie dressed as a feature.
 */
export type ProviderCapabilities = {
  /** Which sync sections this provider implements at all. */
  sections: readonly SyncSection[];
  /** Has a numeric account level (Steam level, not Xbox gamerscore). */
  accountLevel: boolean;
  /** Reports XP toward the next level. */
  accountXp: boolean;
  /** Exposes when a game was purchased/added, enabling that sort. */
  purchaseDates: boolean;
  /** Exposes per-achievement global rarity, enabling a "rarest" showcase. */
  achievementRarity: boolean;
  /** Has tradable item inventories. */
  inventories: boolean;
  /** Can report what the user is playing right now. */
  presence: boolean;
};

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type AccountVisibility = 'public' | 'friends' | 'private' | 'unknown';

export type PresenceStatus =
  | 'offline'
  | 'online'
  | 'busy'
  | 'away'
  | 'snooze'
  | 'looking_to_trade'
  | 'looking_to_play'
  | 'unknown';

export type LinkedAccount = {
  provider: GamingProviderId;
  externalId: string;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
  country: string | null;
  level: number | null;
  xp: number | null;
  visibility: AccountVisibility;
  status: PresenceStatus;
  /** What they are playing right now, when the provider says so. */
  currentGame: { appId: string; name: string } | null;
  linkedAt: string;
  lastSyncedAt: string | null;
};

export type OwnedGame = {
  provider: GamingProviderId;
  appId: string;
  name: string;
  iconUrl: string | null;
  /** Minutes. Providers report wildly different units; this one is normalised. */
  playtimeMinutes: number;
  /** Minutes in the last two weeks, where reported. */
  playtimeRecentMinutes: number;
  lastPlayedAt: string | null;
  achievementsTotal: number | null;
  achievementsUnlocked: number | null;
  /** Null for providers without purchase data — see `ProviderCapabilities`. */
  acquiredAt: string | null;
  /** Set when the title is also in the shared `games` cache. */
  gameId: string | null;
};

export type ProviderAchievement = {
  provider: GamingProviderId;
  appId: string;
  key: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  iconGrayUrl: string | null;
  unlocked: boolean;
  unlockedAt: string | null;
  /** Percentage of owners holding it. Lower is rarer. */
  globalPercent: number | null;
};

/** Per-game achievement rollup, which is what the achievements list renders. */
export type GameAchievementProgress = {
  appId: string;
  name: string;
  iconUrl: string | null;
  total: number;
  unlocked: number;
  /** 0-100. */
  percent: number;
  lastUnlockedAt: string | null;
  lastUnlockedName: string | null;
  isPerfect: boolean;
};

export type InventoryItem = {
  provider: GamingProviderId;
  appId: string;
  itemId: string;
  name: string;
  type: string | null;
  iconUrl: string | null;
  rarity: string | null;
  /** Provider's own hex colour for the rarity, without the leading '#'. */
  rarityColor: string | null;
  amount: number;
  tradable: boolean;
  marketable: boolean;
  /**
   * Canonical market identifier. The single hook a future pricing integration
   * needs — no pricing API is referenced anywhere in this codebase.
   */
  marketHashName: string | null;
};

export type ProviderBadge = {
  provider: GamingProviderId;
  key: string;
  name: string | null;
  iconUrl: string | null;
  level: number | null;
  xp: number | null;
  earnedAt: string | null;
  isYearsOfService: boolean;
};

export type ProviderFriend = {
  provider: GamingProviderId;
  externalId: string;
  handle: string | null;
  avatarUrl: string | null;
  friendsSince: string | null;
  /** Non-null when this friend also uses GameLog — the only case the UI shows. */
  matchedUserId: string | null;
};

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

export type GamingStats = {
  gamesOwned: number;
  totalPlaytimeMinutes: number;
  achievementsUnlocked: number;
  achievementsTotal: number;
  perfectGames: number;
  /** Mean over games with playtime > 0 — see the view comment in 0009. */
  avgPlaytimeMinutes: number;
};

export type LibrarySort = 'most-played' | 'recently-played' | 'alphabetical' | 'recently-purchased';

export const LIBRARY_SORTS: { key: LibrarySort; label: string }[] = [
  { key: 'most-played', label: 'Most played' },
  { key: 'recently-played', label: 'Recently played' },
  { key: 'alphabetical', label: 'A–Z' },
  { key: 'recently-purchased', label: 'Recently purchased' },
];

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'partial' | 'private' | 'error';

export type SectionSyncState = {
  section: SyncSection;
  status: SyncStatus;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  /** The sync service refuses to run this section before this instant. */
  nextRunAfter: string | null;
  attempts: number;
  error: string | null;
};

/**
 * Result of asking a provider to sync one section.
 *
 * `private` is a first-class outcome, not an error: a locked-down Steam profile
 * is a completely normal thing for a user to have and the UI says so rather than
 * showing a failure.
 */
export type SyncOutcome = {
  section: SyncSection;
  status: SyncStatus;
  /** Rows written, for the "synced 412 games" confirmation. */
  written: number;
  /** Set when the section needs another run to finish (achievement scans). */
  hasMore: boolean;
  message: string | null;
};

export type LinkOutcome =
  | { ok: true; externalId: string }
  | { ok: false; reason: 'cancelled' | 'failed' | 'unavailable'; message: string };

// ---------------------------------------------------------------------------
// The provider interface
// ---------------------------------------------------------------------------

/**
 * One linked-account provider.
 *
 * Note what is *not* here: no fetch methods. Provider APIs need secrets that
 * cannot ship in an app bundle, so the actual network calls live in Edge
 * Functions and the client's job is to start a link, ask for a sync, and read
 * the cached results back out of Postgres. A provider that genuinely could be
 * called from the client would still implement this same interface.
 */
export interface GamingAccountProvider {
  readonly id: GamingProviderId;
  readonly label: string;
  readonly capabilities: ProviderCapabilities;

  /** False when the deployment has not configured this provider's credentials. */
  isConfigured(): boolean;

  /** Run the provider's interactive link flow. Resolves when the user returns. */
  link(options: { userId: string }): Promise<LinkOutcome>;

  /** Forget the account and every row synced from it. */
  unlink(options: { userId: string }): Promise<void>;

  /** Ask the backend to refresh one section. */
  sync(options: {
    userId: string;
    section: SyncSection;
    /** Run even if the section's rate-limit window has not elapsed. */
    force?: boolean;
  }): Promise<SyncOutcome>;
}

/** Sections a provider supports, in the order the profile renders them. */
export function supportedSections(provider: GamingAccountProvider): SyncSection[] {
  return SYNC_SECTIONS.filter((section) => provider.capabilities.sections.includes(section));
}

/** Sorts that are meaningful for this provider — see `purchaseDates`. */
export function availableSorts(provider: GamingAccountProvider): typeof LIBRARY_SORTS {
  return LIBRARY_SORTS.filter(
    (sort) => sort.key !== 'recently-purchased' || provider.capabilities.purchaseDates
  );
}

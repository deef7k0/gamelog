import type {
  CachedGame,
  ContributionResult,
  CopyCompleteness,
  CopyCondition,
  GameReleaseRow,
  OwnedCopyRow,
  Profile,
  ReleaseContributionPhotoRow,
  ReleaseContributionRow,
  ReleaseImageRow,
  ReleasePhotoKind,
  ReleaseRegion,
} from '../database.types';
import { makeGameId, type Game } from '../games';
import { supabase } from '../supabase';
import { cacheGame } from './core';
import { rememberCopies } from './seen-copies';
import { uploadImage } from './storage';

/**
 * Physical releases, barcodes, community contributions and owned copies (0024).
 *
 * Three different things, and the names keep them apart:
 *
 *   release       a specific commercial release — canonical, read-only here
 *   contribution  a user's claim about a barcode — pending until approved
 *   copy          one physical copy a user owns
 *
 * Nothing in this file writes a release or a barcode. The canonical tables have
 * no client write policies; every path in goes through a SECURITY DEFINER RPC
 * that validates, rate-limits and decides. See the migration for the rules.
 */

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export type ReleaseWithGame = GameReleaseRow & { game: CachedGame | null };

/** A release with everything its detail view shows. */
export type ReleaseDetail = ReleaseWithGame & {
  images: ReleaseImageRow[];
  barcodes: { barcode: string }[];
};

type ContributorProfile = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;

export type ContributionWithRelations = ReleaseContributionRow & {
  game: CachedGame | null;
  profile: ContributorProfile | null;
  photos: ReleaseContributionPhotoRow[];
};

export type CopyWithRelations = OwnedCopyRow & {
  game: CachedGame | null;
  release: (GameReleaseRow & { barcodes: { barcode: string }[] }) | null;
  contribution: Pick<ReleaseContributionRow, 'id' | 'status' | 'barcode'> | null;
};

/**
 * What a barcode resolves to.
 *
 * `pending` is not "unknown": somebody has already described this box and it is
 * waiting for a second person or a moderator. The scanner offers to confirm it
 * rather than asking the next person to type the same thing again — which is
 * exactly the agreement that makes it canonical.
 */
/**
 * What ScanDex says a barcode is: a game and a platform, never a release — it
 * knows nothing of region or edition. See the `scandex` Edge Function.
 */
export type CatalogueMatch = {
  /** The app-wide id, `igdb:…` — ScanDex speaks IGDB's ids, as this app does. */
  gameId: string;
  title: string;
  /** IGDB's platform name as ScanDex gave it ("Nintendo Switch"), if any. */
  platformName: string | null;
};

export type BarcodeLookup =
  | { kind: 'found'; barcode: string; release: ReleaseDetail }
  | { kind: 'pending'; barcode: string; claims: ContributionWithRelations[] }
  | { kind: 'identified'; barcode: string; match: CatalogueMatch }
  | { kind: 'unknown'; barcode: string };

/*
 * Each select is one string literal, never a concatenation. supabase-js parses
 * the literal *type* to check every column and embed against
 * `database.types.ts`; a string built with `+` is typed `string`, the parse
 * gives up, and a misspelt column would sail through to a runtime 400.
 */
const CONTRIBUTION_SELECT =
  '*, game:games(*), profile:profiles!release_contributions_user_id_fkey(id, username, display_name, avatar_url), photos:release_contribution_photos(*)';

const RELEASE_DETAIL_SELECT =
  '*, game:games(*), images:release_images(*), barcodes:release_barcodes(barcode)';

const COPY_SELECT =
  '*, game:games(*), release:game_releases(*, barcodes:release_barcodes(barcode)), contribution:release_contributions(id, status, barcode)';

// ---------------------------------------------------------------------------
// Releases and barcodes
// ---------------------------------------------------------------------------

/** Every known release of a game, in the order a collector scans a list. */
export async function getGameReleases(gameId: string): Promise<GameReleaseRow[]> {
  const { data, error } = await supabase
    .from('game_releases')
    .select('*')
    .eq('game_id', gameId)
    .order('platform')
    .order('region')
    .order('edition');

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getRelease(releaseId: string): Promise<ReleaseDetail | null> {
  const { data, error } = await supabase
    .from('game_releases')
    .select(RELEASE_DETAIL_SELECT)
    .eq('id', releaseId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as ReleaseDetail | null;
}

/**
 * Resolve a normalised (GTIN-14) barcode. See `lib/barcode.ts` for how a scan
 * becomes one.
 *
 * Gamelog's own database and nothing else: no third-party UPC service is asked,
 * because the ones that exist are either undocumented or licensed in ways a
 * community catalogue cannot build on. An unknown barcode is the start of a
 * contribution, not a failure.
 */
export async function lookupBarcode(barcode: string): Promise<BarcodeLookup> {
  const canonical = await supabase
    .from('release_barcodes')
    .select('barcode, release_id')
    .eq('barcode', barcode)
    .maybeSingle();

  if (canonical.error) {
    console.warn('[releases] barcode lookup failed:', canonical.error.message);
    throw new Error(canonical.error.message);
  }

  if (canonical.data) {
    const release = await getRelease(canonical.data.release_id);
    if (release) return { kind: 'found', barcode, release };
    /* A barcode pointing at a release that is not there cannot happen through
       the RPCs (the foreign key cascades), so if it does it is worth hearing
       about — and the reader is better served by the contribution flow than by
       an error. */
    console.warn('[releases] barcode resolved to a missing release:', barcode);
  }

  const pending = await supabase
    .from('release_contributions')
    .select(CONTRIBUTION_SELECT)
    .eq('barcode', barcode)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (pending.error) {
    console.warn('[releases] pending-claim lookup failed:', pending.error.message);
    throw new Error(pending.error.message);
  }

  const claims = (pending.data ?? []) as ContributionWithRelations[];
  if (claims.length > 0) return { kind: 'pending', barcode, claims };

  /* Nothing of our own: ask ScanDex's catalogue. Last, because a release here
     says more (region, edition) and a pending claim is somebody's work waiting
     for a second pair of eyes — and because it is the only step that spends a
     third party's quota. */
  const match = await identifyBarcode(barcode);
  return match ? { kind: 'identified', barcode, match } : { kind: 'unknown', barcode };
}

/**
 * Ask ScanDex, through the `scandex` Edge Function, which game a barcode is.
 *
 * **Never throws.** ScanDex is a convenience on top of the scanner, so when it
 * is unreachable — the function not deployed, no token set, a timeout — the
 * scan still ends where it did before ScanDex existed, at "we don't recognize
 * this", with the way to add it.
 */
async function identifyBarcode(barcode: string): Promise<CatalogueMatch | null> {
  const { data, error } = await supabase.functions.invoke('scandex', { body: { barcode } });
  if (error) {
    console.warn('[releases] ScanDex lookup unavailable:', error.message);
    return null;
  }

  const answer = data as {
    status?: string;
    game?: { igdbId?: unknown; name?: unknown };
    platform?: { name?: unknown };
  } | null;
  if (
    answer?.status !== 'matched' ||
    typeof answer.game?.igdbId !== 'number' ||
    typeof answer.game.name !== 'string'
  ) {
    return null;
  }

  return {
    gameId: makeGameId('igdb', answer.game.igdbId),
    title: answer.game.name,
    platformName: typeof answer.platform?.name === 'string' ? answer.platform.name : null,
  };
}

// ---------------------------------------------------------------------------
// Contributions
// ---------------------------------------------------------------------------

export type ContributionPhoto = { kind: ReleasePhotoKind; localUri: string };

export type ContributionInput = {
  barcode: string;
  game: Game;
  platform: string;
  region: ReleaseRegion;
  edition: string;
  publisher?: string | null;
  /** ISO date, `YYYY-MM-DD`. */
  releaseDate?: string | null;
  catalogNumber?: string | null;
  notes?: string | null;
};

/**
 * Submit a release for an unknown barcode.
 *
 * Photos are uploaded first and passed to the RPC as URLs, so they are attached
 * before the database decides whether this claim agrees with someone else's —
 * uploaded after, they would miss the copy into the canonical release's images.
 * An upload that succeeds for a submission the RPC then refuses (the barcode
 * became canonical a moment ago, say) leaves an orphaned file in the user's own
 * folder, which is the cheaper failure of the two.
 */
export async function submitReleaseContribution(
  userId: string,
  input: ContributionInput,
  photos: ContributionPhoto[] = []
): Promise<ContributionResult> {
  await cacheGame(input.game);

  const uploaded: { kind: ReleasePhotoKind; url: string }[] = [];
  for (const photo of photos) {
    uploaded.push({ kind: photo.kind, url: await uploadImage(userId, photo.localUri, 'releases') });
  }

  const { data, error } = await supabase.rpc('submit_release_contribution', {
    p_barcode: input.barcode,
    p_game_id: input.game.id,
    p_platform: input.platform,
    p_region: input.region,
    p_edition: input.edition,
    p_publisher: input.publisher ?? null,
    p_release_date: input.releaseDate ?? null,
    p_catalog_number: input.catalogNumber ?? null,
    p_notes: input.notes ?? null,
    p_photos: uploaded,
  });

  if (error) {
    console.warn('[releases] contribution rejected:', error.message);
    throw new Error(error.message);
  }
  return data as ContributionResult;
}

/** Edit your own pending claim. The barcode cannot change — that is a new claim. */
export async function updateReleaseContribution(
  contributionId: string,
  input: Omit<ContributionInput, 'barcode'>
): Promise<ContributionResult> {
  await cacheGame(input.game);

  const { data, error } = await supabase.rpc('update_release_contribution', {
    p_id: contributionId,
    p_game_id: input.game.id,
    p_platform: input.platform,
    p_region: input.region,
    p_edition: input.edition,
    p_publisher: input.publisher ?? null,
    p_release_date: input.releaseDate ?? null,
    p_catalog_number: input.catalogNumber ?? null,
    p_notes: input.notes ?? null,
  });

  if (error) {
    console.warn('[releases] contribution edit rejected:', error.message);
    throw new Error(error.message);
  }
  return data as ContributionResult;
}

/**
 * "This matches my copy." Seconds someone else's pending claim — and if yours is
 * the agreement it was waiting for, it becomes canonical in the same call.
 */
export async function confirmReleaseContribution(
  contributionId: string
): Promise<ContributionResult> {
  const { data, error } = await supabase.rpc('confirm_release_contribution', {
    p_id: contributionId,
  });

  if (error) {
    console.warn('[releases] confirmation rejected:', error.message);
    throw new Error(error.message);
  }
  return data as ContributionResult;
}

/** Take back your own pending claim. */
export async function withdrawReleaseContribution(contributionId: string): Promise<void> {
  const { error } = await supabase
    .from('release_contributions')
    .delete()
    .eq('id', contributionId)
    .eq('status', 'pending');

  if (error) throw new Error(error.message);
}

export async function getContribution(
  contributionId: string
): Promise<ContributionWithRelations | null> {
  const { data, error } = await supabase
    .from('release_contributions')
    .select(CONTRIBUTION_SELECT)
    .eq('id', contributionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as ContributionWithRelations | null;
}

/** Everything a user has submitted, newest first — their contribution history. */
export async function getMyContributions(userId: string): Promise<ContributionWithRelations[]> {
  const { data, error } = await supabase
    .from('release_contributions')
    .select(CONTRIBUTION_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data ?? []) as ContributionWithRelations[];
}

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

/** Whether the signed-in user is a moderator. False, not an error, when signed out. */
export async function isModerator(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_moderator');
  if (error) {
    console.warn('[moderation] could not check moderator status:', error.message);
    return false;
  }
  return data === true;
}

/** The review queue, oldest first — first come, first judged. */
export async function getPendingContributions(limit = 50): Promise<ContributionWithRelations[]> {
  const { data, error } = await supabase
    .from('release_contributions')
    .select(CONTRIBUTION_SELECT)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as ContributionWithRelations[];
}

export async function moderateContribution(
  contributionId: string,
  decision: 'approve' | 'reject',
  note?: string | null
): Promise<void> {
  const { error } = await supabase.rpc('moderate_release_contribution', {
    p_id: contributionId,
    p_decision: decision,
    p_note: note?.trim() || null,
  });

  if (error) {
    console.warn(`[moderation] ${decision} failed:`, error.message);
    throw new Error(error.message);
  }
}

// ---------------------------------------------------------------------------
// Owned copies
// ---------------------------------------------------------------------------

/** A user's copies, newest first; one game's when `gameId` is given. */
export async function getCopies(userId: string, gameId?: string): Promise<CopyWithRelations[]> {
  let query = supabase.from('owned_copies').select(COPY_SELECT).eq('user_id', userId);
  if (gameId) query = query.eq('game_id', gameId);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return rememberCopies((data ?? []) as CopyWithRelations[]);
}

export async function getCopy(copyId: string): Promise<CopyWithRelations | null> {
  const { data, error } = await supabase
    .from('owned_copies')
    .select(COPY_SELECT)
    .eq('id', copyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const copy = data as CopyWithRelations | null;
  if (copy) rememberCopies([copy]);
  return copy;
}

export type CopyInput = {
  /** A release when one is known. The database fills platform/region/edition from it. */
  releaseId: string | null;
  /** The pending claim this copy is waiting on, when its barcode was unknown. */
  contributionId: string | null;
  platform: string | null;
  region: ReleaseRegion | null;
  edition: string | null;
  completeness: CopyCompleteness | null;
  condition: CopyCondition | null;
  notes: string | null;
  acquiredOn: string | null;
};

function copyColumns(input: CopyInput) {
  return {
    release_id: input.releaseId,
    contribution_id: input.contributionId,
    platform: input.platform?.trim() || null,
    region: input.region,
    edition: input.edition?.trim() || null,
    completeness: input.completeness,
    condition: input.condition,
    notes: input.notes?.trim() || null,
    acquired_on: input.acquiredOn || null,
  };
}

export async function addCopy(userId: string, game: Game, input: CopyInput): Promise<string> {
  await cacheGame(game);

  const { data, error } = await supabase
    .from('owned_copies')
    .insert({ user_id: userId, game_id: game.id, ownership: 'physical', ...copyColumns(input) })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

export async function updateCopy(copyId: string, input: CopyInput): Promise<void> {
  const { error } = await supabase.from('owned_copies').update(copyColumns(input)).eq('id', copyId);
  if (error) throw new Error(error.message);
}

/** The longest note a copy can carry — `owned_copies.notes`' CHECK in 0024. */
export const COPY_NOTES_MAX = 500;

/**
 * Write a copy's notes and nothing else.
 *
 * The copy's own screen edits the note in place; everything else about the copy
 * is still the copy form's (`updateCopy`), which writes every column at once
 * and would need the whole record to change one. Blank is stored as null.
 */
export async function updateCopyNotes(copyId: string, notes: string): Promise<string | null> {
  const value = notes.trim() || null;
  const { error } = await supabase.from('owned_copies').update({ notes: value }).eq('id', copyId);
  if (error) throw new Error(error.message);
  return value;
}

export async function deleteCopy(copyId: string): Promise<void> {
  const { error } = await supabase.from('owned_copies').delete().eq('id', copyId);
  if (error) throw new Error(error.message);
}

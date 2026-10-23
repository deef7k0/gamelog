import { supabase } from '@/lib/supabase';

import type {
  GamingAccountProvider,
  GamingProviderId,
  LinkOutcome,
  ProviderCapabilities,
  SyncOutcome,
  SyncSection,
} from './types';

/**
 * PlayStation, Xbox and GOG, linked as RAWG links them: by the name the person
 * goes by on the service, and only what that service shows to anybody
 * (`functions/game-accounts`, 0044). No sign-in to the person's account and no
 * proof it is theirs — the account says it was linked by username.
 *
 * One library section: their games, with trophy or achievement counts where
 * the service has them. GOG reports playtime; PlayStation's trophy list and
 * Xbox's title history do not.
 */
export type UsernameProviderId = Extract<GamingProviderId, 'playstation' | 'xbox' | 'gog'>;

/** What the function answers: RAWG's statuses (`_shared/game-accounts.ts`). */
export type ImportStatus =
  | 'ready'
  | 'private-user'
  | 'private-games'
  | 'not-found'
  | 'taken'
  | 'unavailable'
  | 'unconfigured'
  | 'error';

type ImportResponse = {
  status?: ImportStatus;
  message?: string | null;
  games?: number | null;
  skipped?: boolean;
  error?: string;
};

const CAPABILITIES: ProviderCapabilities = {
  sections: ['library'],
  accountLevel: false,
  accountXp: false,
  purchaseDates: false,
  achievementRarity: false,
  inventories: false,
  presence: false,
};

/**
 * What the person is asked for, and what has to be public — RAWG's own help
 * text, as its web app ships it (2026-10-22), word for word where it can be.
 */
export const USERNAME_FORM: Record<
  UsernameProviderId,
  { field: string; placeholder: string; hint: string; privacy: string; playtime: boolean }
> = {
  playstation: {
    field: 'PSN Online ID',
    placeholder: 'Your Online ID, not your sign-in email',
    hint: 'Only games with trophies can be imported.',
    privacy:
      'Make sure your trophies are public. On PlayStation: Settings › PlayStation Network/Account Management › Privacy Settings › Sharing Your Experience › Trophies.',
    playtime: false,
  },
  xbox: {
    field: 'Xbox gamertag',
    placeholder: 'Your gamertag',
    hint: 'Your game history is imported, with achievements.',
    privacy:
      'Make sure your profile is public. On Xbox: Settings › Account › Privacy and online safety › Xbox Live privacy › View details and customize › Online status and history — let everybody see your game and app history. Under Profile, let everybody see your profile.',
    playtime: false,
  },
  gog: {
    field: 'GOG username',
    placeholder: 'From your profile’s address: gog.com/u/YOUR_USERNAME',
    hint: 'Your GOG games are imported, with playtime.',
    privacy:
      'Make sure your profile and games are public. On GOG: Privacy & settings › Privacy — set your profile page and full game library to “all visitors”.',
    playtime: true,
  },
};

export class UsernameProvider implements GamingAccountProvider {
  readonly capabilities = CAPABILITIES;

  constructor(
    readonly id: UsernameProviderId,
    readonly label: string
  ) {}

  /** The function decides — it answers `unconfigured` without a service's key. */
  isConfigured(): boolean {
    return true;
  }

  async link({ handle }: { userId: string; handle?: string }): Promise<LinkOutcome> {
    if (!handle?.trim()) {
      return { ok: false, reason: 'failed', message: `Type your ${USERNAME_FORM[this.id].field}.` };
    }
    const answer = await this.call({ action: 'link', provider: this.id, handle: handle.trim() });
    if (answer.status === 'ready') return { ok: true, externalId: handle.trim() };
    return {
      ok: false,
      reason: answer.status === 'unconfigured' ? 'unavailable' : 'failed',
      message: answer.message ?? answer.error ?? `Could not import from ${this.label}.`,
    };
  }

  async unlink(): Promise<void> {
    const answer = await this.call({ action: 'unlink', provider: this.id });
    if (answer.error) throw new Error(answer.error);
  }

  async sync({ section }: { userId: string; section: SyncSection }): Promise<SyncOutcome> {
    const answer = await this.call({ action: 'sync', provider: this.id });
    const status: SyncOutcome['status'] =
      answer.status === 'ready'
        ? 'ok'
        : answer.status === 'private-user' || answer.status === 'private-games'
          ? 'private'
          : 'error';
    return {
      section,
      status,
      written: answer.games ?? 0,
      hasMore: false,
      message: answer.message ?? answer.error ?? null,
    };
  }

  private async call(body: Record<string, string>): Promise<ImportResponse> {
    const { data, error } = await supabase.functions.invoke<ImportResponse>('game-accounts', {
      body,
    });
    if (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: 'unconfigured',
        message: /non-2xx|not found|failed to send/i.test(message)
          ? `${this.label} import is not connected yet.`
          : message,
      };
    }
    return data ?? { status: 'error' };
  }
}

export const playstationProvider = new UsernameProvider('playstation', 'PlayStation');
export const xboxProvider = new UsernameProvider('xbox', 'Xbox');
export const gogProvider = new UsernameProvider('gog', 'GOG');

export const USERNAME_PROVIDERS: readonly UsernameProvider[] = [
  playstationProvider,
  xboxProvider,
  gogProvider,
];

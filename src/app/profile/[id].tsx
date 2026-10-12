import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';

import { ProfileView } from '@/components/profile-view';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { EmptyState, Screen } from '@/components/ui/screen';
import { getProfile } from '@/lib/api';
import { displayNameFor } from '@/lib/format';

/**
 * Someone else's profile: the bar with their handle in it, then
 * `<ProfileView>`.
 *
 * ## The handle is the bar's title, and it is centred
 *
 * This screen was pushed, so it has the bar every pushed screen has — clear
 * over the top of the profile, frost once the profile has scrolled under it.
 * Its title is the person's handle, as your own profile's row is given to
 * yours, so the header under it can open on the name alone; and it is centred
 * on the screen as yours is, which is why this is the one bar that asks for
 * `centerTitle`.
 *
 * (The handle was first put in this row when there was no bar — only a disc
 * of glass — and the screen drew the word itself in a band the disc's height.
 * The bar has a title now, so the band is gone and the word is the bar's.)
 */
export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  /* The same key `<ProfileView>` reads, so this is the cache, not a request. */
  const profile = useQuery({
    queryKey: ['profile', id],
    queryFn: () => getProfile(id!),
    enabled: !!id,
  });
  const handle = profile.data?.username || (profile.data ? displayNameFor(profile.data) : '');

  return (
    <Screen edges={[]} insetHeader topBar={<FrostedTopBar back title={handle} centerTitle />}>
      {id ? <ProfileView profileId={id} /> : <EmptyState title="Profile not found" />}
    </Screen>
  );
}

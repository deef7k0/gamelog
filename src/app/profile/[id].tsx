import { useLocalSearchParams } from 'expo-router';

import { ProfileView } from '@/components/profile-view';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { EmptyState, Screen } from '@/components/ui/screen';
import { useTopBarScroll } from '@/hooks/use-screen-chrome';

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { onScroll } = useTopBarScroll();

  return (
    /* Someone *else's* profile keeps the back disc — unlike the Profile tab,
       this one was pushed and there is somewhere to return to. The banner runs
       underneath it and the name is the first thing below, so the disc is the
       only chrome the screen needs. */
    <Screen edges={[]} topBar={<FrostedTopBar back />}>
      {id ? (
        <ProfileView profileId={id} onScroll={onScroll} />
      ) : (
        <EmptyState title="Profile not found" />
      )}
    </Screen>
  );
}

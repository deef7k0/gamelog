import { useLocalSearchParams } from 'expo-router';

import { ProfileView } from '@/components/profile-view';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { EmptyState, Screen } from '@/components/ui/screen';
import { useTopBarScroll } from '@/hooks/use-screen-chrome';

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { scrollY, onScroll } = useTopBarScroll();

  return (
    /* No title: the banner runs under the bar and the person's name is the
       first thing below it. The chevron is the only thing this bar owes you. */
    <Screen edges={[]} topBar={<FrostedTopBar back scrollY={scrollY} />}>
      {id ? (
        <ProfileView profileId={id} onScroll={onScroll} />
      ) : (
        <EmptyState title="Profile not found" />
      )}
    </Screen>
  );
}

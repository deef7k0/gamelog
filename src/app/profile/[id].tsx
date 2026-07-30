import { useLocalSearchParams } from 'expo-router';

import { ProfileView } from '@/components/profile-view';
import { EmptyState, Screen } from '@/components/ui/screen';

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen edges={[]}>
      {id ? <ProfileView profileId={id} /> : <EmptyState title="Profile not found" />}
    </Screen>
  );
}

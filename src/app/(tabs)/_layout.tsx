import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';

import { FloatingTabBar } from '@/components/FloatingTabBar';
import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { hasSeenOnboarding } from '@/lib/onboarding';
import { colors } from '@/theme';

export default function TabsLayout() {
  const { loading } = useAuth();
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    hasSeenOnboarding()
      .then(setSeen)
      .catch(() => setSeen(true));
  }, []);

  if (seen === null || loading) return <Loading />;
  if (!seen) return <Redirect href="/onboarding" />;

  // Floating pill tab bar: Explore, My reviews, (Verification for admins) + a separate "Submit review" button.
  // Help is a sheet opened from the "?" button in each screen header, not a tab.
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Explore' }} />
      <Tabs.Screen name="my-reviews" options={{ title: 'My reviews' }} />
      <Tabs.Screen name="admin" options={{ title: 'Verification' }} />
      <Tabs.Screen name="submit" options={{ title: 'Submit a review' }} />
    </Tabs>
  );
}

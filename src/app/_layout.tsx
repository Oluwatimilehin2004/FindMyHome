import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/lib/auth';
import { NotificationsProvider } from '@/lib/notifications';
import { colors } from '@/theme';

export default function RootLayout() {
  const [loaded, error] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });

  // Never get stuck on fonts: after 3 s carry on with the system font.
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGaveUp(true), 3000);
    return () => clearTimeout(t);
  }, []);

  if (!loaded && !error && !gaveUp) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  // Every screen draws its own header (TopBar / PageTitle), so the native header is off everywhere.
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationsProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
            <Stack.Screen name="property/[id]" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="auth/login" options={{ presentation: 'modal' }} />
            <Stack.Screen name="auth/signup" options={{ presentation: 'modal' }} />
            <Stack.Screen name="admin/review/[id]" />
            <Stack.Screen name="admin/add-property" />
            <Stack.Screen name="admin/edit-property/[id]" />
            <Stack.Screen name="admin/add-review" />
          </Stack>
        </NotificationsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

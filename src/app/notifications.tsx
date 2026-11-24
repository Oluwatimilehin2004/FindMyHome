import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, EmptyState, T, TopBar } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/labels';
import { useNotifications } from '@/lib/notifications';
import { colors, radius, space } from '@/theme';

function timeOf(iso: string) {
  const d = new Date(iso);
  return `${formatDate(iso)}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function NotificationsScreen() {
  const { session } = useAuth();
  const { items, unread, loading, refresh, markRead } = useNotifications();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right', 'bottom']}>
      <TopBar
        title="Notifications"
        right={
          unread ? (
            <Pressable onPress={() => markRead()} hitSlop={8} accessibilityRole="button" style={{ width: 40, alignItems: 'flex-end' }}>
              <Ionicons name="checkmark-done-outline" size={22} color={colors.text} accessibilityLabel="Mark all as read" />
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        {!session ? (
          <Card>
            <EmptyState icon="notifications-outline" title="Sign in to receive notifications" />
            <Button title="Sign in" onPress={() => router.push('/auth/login')} />
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <EmptyState
              icon="notifications-outline"
              title="No notifications"
              body="You will be notified here when the FindMyHome team approves or declines one of your reviews."
            />
          </Card>
        ) : (
          items.map((n) => {
            const approved = n.kind === 'review_approved';
            const unreadItem = !n.read_at;
            return (
              <Pressable
                key={n.id}
                accessibilityRole="button"
                onPress={() => {
                  if (unreadItem) void markRead([n.id]);
                  router.push('/my-reviews');
                }}
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
              >
                <Card accent={approved ? colors.ok : colors.danger} style={{ gap: space.xs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: radius.pill,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: approved ? colors.okSoft : colors.dangerSoft,
                      }}
                    >
                      <Ionicons
                        name={approved ? 'checkmark' : 'close'}
                        size={15}
                        color={approved ? colors.ok : colors.danger}
                      />
                    </View>
                    <T weight="semibold" size={14} style={{ flex: 1 }}>
                      {n.title}
                    </T>
                    {unreadItem ? (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger }} />
                    ) : null}
                  </View>
                  <T size={13} color={colors.text} style={{ lineHeight: 20 }}>
                    {n.body}
                  </T>
                  <T size={11} color={colors.muted}>
                    {timeOf(n.created_at)}
                  </T>
                </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

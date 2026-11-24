import { router } from 'expo-router';
import { View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { useNotifications } from '@/lib/notifications';
import { colors } from '@/theme';

import { IconButton, T } from './ui';

/** Round bell button with an unread count; hidden for guests. */
export function NotificationBell() {
  const { session } = useAuth();
  const { unread } = useNotifications();
  if (!session) return null;
  return (
    <View>
      <IconButton
        icon={unread ? 'notifications' : 'notifications-outline'}
        label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        onPress={() => router.push('/notifications')}
      />
      {unread ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: 9,
            backgroundColor: colors.danger,
            borderWidth: 2,
            borderColor: colors.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <T size={10} weight="semibold" color="#FFFFFF" style={{ lineHeight: 12 }}>
            {unread > 9 ? '9+' : unread}
          </T>
        </View>
      ) : null}
    </View>
  );
}

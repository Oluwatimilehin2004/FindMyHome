import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { colors, radius, space, strongShadow } from '@/theme';

import type { IconName } from './ui';

/** Routes shown as icons in the pill, in order. "submit" is the separate round + button. */
const ICONS: Record<string, { outline: IconName; filled: IconName; label: string }> = {
  index: { outline: 'home-outline', filled: 'home', label: 'Explore' },
  'my-reviews': { outline: 'document-text-outline', filled: 'document-text', label: 'My reviews' },
  admin: { outline: 'shield-checkmark-outline', filled: 'shield-checkmark', label: 'Verification queue' },
};

/**
 * Floating pill tab bar with a separate dark "+" button (reference design).
 * Hides while the keyboard is open so it never covers form fields.
 */
export function FloatingTabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { isAdmin } = useAuth();
  const [keyboard, setKeyboard] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (keyboard) return null;

  const press = (key: string, focused: boolean) => {
    const event = emitter.emit({ type: 'tabPress', target: key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigateToTab(key);
  };

  const tabs = state.routes
    .map((route, index) => ({ route, index }))
    .filter(({ route }) => ICONS[route.name] && (route.name !== 'admin' || isAdmin));
  const submit = state.routes.findIndex((r) => r.name === 'submit');
  const home = state.routes.findIndex((r) => r.name === 'index');
  const onSubmitTab = state.index === submit;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: Math.max(insets.bottom, space.md) + space.xs,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: space.md,
      }}
    >
      <View
        role="tablist"
        style={[
          {
            flexDirection: 'row',
            gap: space.xs,
            padding: 6,
            borderRadius: radius.pill,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.hairline,
          },
          strongShadow,
          { shadowOpacity: 0.1 },
        ]}
      >
        {tabs.map(({ route, index }) => {
          const focused = state.index === index;
          const meta = ICONS[route.name];
          return (
            <Pressable
              key={route.key}
              role="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={meta.label}
              onPress={() => press(route.key, focused)}
              style={({ pressed }) => ({
                width: 48,
                height: 44,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: focused ? colors.raised : 'transparent',
                borderWidth: focused ? 1 : 0,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name={focused ? meta.filled : meta.outline} size={20} color={focused ? colors.text : colors.muted} />
            </Pressable>
          );
        })}
      </View>

      {submit >= 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={onSubmitTab ? 'Close review form' : 'Submit a review'}
          onPress={() => (onSubmitTab ? press(state.routes[home].key, false) : press(state.routes[submit].key, false))}
          style={({ pressed }) => [
            {
              width: 58,
              height: 58,
              borderRadius: 29,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            },
            strongShadow,
          ]}
        >
          <Ionicons name={onSubmitTab ? 'close' : 'add'} size={26} color={colors.primaryText} />
        </Pressable>
      ) : null}
    </View>
  );
}

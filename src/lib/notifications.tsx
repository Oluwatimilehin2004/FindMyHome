import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { getNotifications, markNotificationsRead } from './api';
import { useAuth } from './auth';
import { supabase } from './supabase';
import type { AppNotification } from './types';

/**
 * Review-decision notifications.
 *
 * - The list lives in the `notifications` table (created by moderate_review on the server).
 * - While the app is open, new rows arrive instantly through Supabase Realtime.
 * - Each new decision is also shown as a phone notification. Decisions made while the app was
 *   closed are shown the next time the app opens (works in Expo Go; no push server needed).
 */

const ALERTED_KEY = 'fmh.notifications.alerted.v1';
const PERMISSION_ASKED_KEY = 'fmh.notifications.asked.v1';
const supported = Platform.OS !== 'web';

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

interface NotificationState {
  items: AppNotification[];
  unread: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (ids?: string[]) => Promise<void>;
}

const Ctx = createContext<NotificationState | null>(null);

async function ensurePermission(): Promise<boolean> {
  if (!supported) return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    // Ask once; respect the student's choice afterwards.
    if (await AsyncStorage.getItem(PERMISSION_ASKED_KEY)) return false;
    await AsyncStorage.setItem(PERMISSION_ASKED_KEY, '1');
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('reviews', {
        name: 'Review decisions',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

async function showOnPhone(n: AppNotification) {
  if (!supported) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: n.title, body: n.body, data: { url: '/notifications' } },
      trigger: Platform.OS === 'android' ? { channelId: 'reviews' } : null,
    });
  } catch {
    // Notifications are a convenience; the in-app list is the record.
  }
}

async function loadAlerted(): Promise<Set<string> | null> {
  const raw = await AsyncStorage.getItem(ALERTED_KEY).catch(() => null);
  return raw ? new Set(JSON.parse(raw) as string[]) : null;
}

async function saveAlerted(ids: Set<string>) {
  // Keep the most recent ids only.
  await AsyncStorage.setItem(ALERTED_KEY, JSON.stringify([...ids].slice(-200))).catch(() => undefined);
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const alerted = useRef<Set<string> | null>(null);

  /** Show phone notifications for unread items not yet alerted on this device. */
  const alertNew = useCallback(async (list: AppNotification[]) => {
    if (!alerted.current) {
      const stored = await loadAlerted();
      if (!stored) {
        // First run on this device: record existing items without alerting for old news.
        alerted.current = new Set(list.map((n) => n.id));
        await saveAlerted(alerted.current);
        return;
      }
      alerted.current = stored;
    }
    const fresh = list.filter((n) => !n.read_at && !alerted.current!.has(n.id)).slice(0, 3);
    if (!fresh.length) return;
    if (await ensurePermission()) {
      for (const n of fresh) await showOnPhone(n);
    }
    fresh.forEach((n) => alerted.current!.add(n.id));
    await saveAlerted(alerted.current);
  }, []);

  const refresh = useCallback(async () => {
    if (!uid) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const list = await getNotifications();
      setItems(list);
      void alertNew(list);
    } catch {
      // Offline: keep what we have.
    } finally {
      setLoading(false);
    }
  }, [uid, alertNew]);

  const markRead = useCallback(async (ids?: string[]) => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (!ids || ids.includes(n.id) ? { ...n, read_at: n.read_at ?? now } : n)));
    try {
      await markNotificationsRead(ids);
    } catch {
      // Retried on the next refresh.
    }
  }, []);

  // Load on sign-in, clear on sign-out.
  useEffect(() => {
    alerted.current = null;
    void refresh();
  }, [refresh]);

  // Live updates while the app is open.
  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`notifications-${uid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        (payload) => {
          const n = payload.new as AppNotification;
          setItems((prev) => (prev.some((p) => p.id === n.id) ? prev : [n, ...prev]));
          void alertNew([n]);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [uid, alertNew]);

  // Catch up whenever the app returns to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // Tapping a phone notification opens the notifications screen.
  useEffect(() => {
    if (!supported) return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (typeof url === 'string') router.push(url as '/notifications');
    });
    return () => sub.remove();
  }, []);

  const value = useMemo<NotificationState>(
    () => ({ items, unread: items.filter((n) => !n.read_at).length, loading, refresh, markRead }),
    [items, loading, refresh, markRead],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications(): NotificationState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationsProvider>');
  return ctx;
}

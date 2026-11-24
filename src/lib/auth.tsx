import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from './supabase';
import type { Profile } from './types';

interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { email: string; password: string; fullName: string; isInternational: boolean }) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      return;
    }
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, university, is_international, role')
        .eq('id', s.user.id)
        .maybeSingle();
      setProfile((data as Profile | null) ?? null);
    } catch {
      // Offline or slow network: keep going without the profile; it reloads on the next auth change.
    }
  }, []);

  useEffect(() => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        setLoading(false);
      }
    };
    // Never block the app on the network for more than a few seconds (NFR 8, §5.1 launch time).
    const timer = setTimeout(finish, 4000);

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        finish(); // show the app now; the profile (admin tab etc.) fills in when it arrives
        void loadProfile(data.session);
      })
      .catch(finish);

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Defer to avoid calling Supabase inside the auth callback.
      setTimeout(() => void loadProfile(s), 0);
    });
    return () => {
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      profile,
      isAdmin: profile?.role === 'admin',
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      },
      async signUp({ email, password, fullName, isInternational }) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim(), is_international: isInternational } },
        });
        if (error) throw error;
        if (!data.session) {
          throw new Error(
            'Your account was created, but email confirmation is enabled in Supabase. Disable it (SRS §3.4) or confirm the email, then sign in.',
          );
        }
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [loading, session, profile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

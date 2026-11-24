import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// Accept common copy-paste variants (trailing slash, /rest/v1, quotes) and reduce to
// the bare project URL, e.g. https://abcdxyz.supabase.co — otherwise Supabase answers
// "Invalid path specified in request URL".
const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '')
  .trim()
  .replace(/^["']|["']$/g, '')
  .replace(/\/(rest|auth|storage)\/v1\/?.*$/, '')
  .replace(/\/+$/, '');
const anonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim().replace(/^["']|["']$/g, '');

if (!url || !anonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.',
  );
}
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
  throw new Error(
    `EXPO_PUBLIC_SUPABASE_URL should look like https://abcdxyz.supabase.co (from Connect → Project URL), but it is "${url}".`,
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Only refresh tokens while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export const PROOF_BUCKET = 'tenancy-proofs';
export const PHOTO_BUCKET = 'property-photos';

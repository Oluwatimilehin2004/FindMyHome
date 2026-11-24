import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { Button, Card, CheckGroup, Divider, ErrorText, Field, Overline, Screen, T, TopBar } from '@/components/ui';
import { friendlyError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, space } from '@/theme';

// FR 1.1 — collects only what the core functions need (SRS §5.3 data minimisation).
export default function Signup() {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isInternational, setIsInternational] = useState(false);
  const [consent, setConsent] = useState<'consent'[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!fullName.trim()) return setError('Please enter your full name. It is visible to the FindMyHome team only.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Please enter a valid email address.');
    if (password.length < 8) return setError('Your password must be at least 8 characters long.');
    if (!consent.length) return setError('Please accept the data handling statement to continue.');
    setBusy(true);
    setError(null);
    try {
      await signUp({ email, password, fullName, isInternational });
      router.back();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} header={<TopBar title="Create account" />}>
      <View style={{ gap: space.xs, marginTop: space.sm }}>
        <T weight="semibold" size={24} style={{ letterSpacing: -0.4 }}>
          Create your account
        </T>
        <T size={13} color={colors.muted}>
          Your name is never published on reviews. It is used only by the FindMyHome team to confirm that reviewers
          lived where they state.
        </T>
      </View>

      <Card style={{ gap: space.md }}>
        <Overline>Personal details</Overline>
        <Field label="Full name" value={fullName} onChangeText={setFullName} autoComplete="name" />
        <Field
          label="Email address"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="name@alustudent.com"
        />
        <Field
          label="Password"
          hint="At least 8 characters."
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <Divider />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <T size={14}>International student</T>
            <T size={12} color={colors.muted}>
              Used only for anonymous statistics.
            </T>
          </View>
          <Switch
            value={isInternational}
            onValueChange={setIsInternational}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.raised}
          />
        </View>
      </Card>

      <CheckGroup
        options={[
          {
            value: 'consent' as const,
            label:
              'I agree that FindMyHome may store my account details and any evidence of tenancy I upload, accessible only to the FindMyHome team, for the purpose of verifying reviews (Rwanda Data Protection Law, 2021).',
          },
        ]}
        value={consent}
        onChange={setConsent}
      />

      <ErrorText message={error} />
      <Button title="Create account" onPress={submit} loading={busy} />
      <Pressable onPress={() => router.replace('/auth/login')} style={{ alignItems: 'center', padding: space.sm }}>
        <T size={13} color={colors.muted}>
          Already registered?{' '}
          <T size={13} weight="medium">
            Sign in
          </T>
        </T>
      </Pressable>
    </Screen>
  );
}

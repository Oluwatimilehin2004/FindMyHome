import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, ErrorText, Field, Screen, T, TopBar } from '@/components/ui';
import { friendlyError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, space } from '@/theme';

// FR 1.2
export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email.trim() || !password) {
      setError('Please enter your email address and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      router.back();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} header={<TopBar title="Sign in" />}>
      <View style={{ gap: space.xs, marginTop: space.sm }}>
        <T weight="semibold" size={24} style={{ letterSpacing: -0.4 }}>
          Welcome back
        </T>
        <T size={13} color={colors.muted}>
          Reviews can be read without an account. Sign in to submit a review of a property you have rented.
        </T>
      </View>
      <Card style={{ gap: space.md }}>
        <Field
          label="Email address"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="name@alustudent.com"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          onSubmitEditing={submit}
        />
      </Card>
      <ErrorText message={error} />
      <Button title="Sign in" onPress={submit} loading={busy} />
      <Pressable onPress={() => router.replace('/auth/signup')} style={{ alignItems: 'center', padding: space.sm }}>
        <T size={13} color={colors.muted}>
          No account yet?{' '}
          <T size={13} weight="medium">
            Create an account
          </T>
        </T>
      </Pressable>
    </Screen>
  );
}

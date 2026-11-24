import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';

import { friendlyError, getLandlordContact, landlordContactAvailable } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { LandlordContact } from '@/lib/types';
import { colors, space } from '@/theme';

import { Button, Card, Divider, ErrorText, KeyValue, Overline, T } from './ui';

/**
 * "Contact the landlord": shown after the reviews. Guests are asked to sign in first;
 * signed-in students reveal the number for this property only (each request is logged).
 */
export function LandlordContactCard({ propertyId }: { propertyId: string }) {
  const { session } = useAuth();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [contact, setContact] = useState<LandlordContact | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    landlordContactAvailable(propertyId)
      .then(setAvailable)
      .catch(() => setAvailable(false));
  }, [propertyId]);

  // Hide the number again if the user signs out.
  useEffect(() => {
    if (!session) setContact(null);
  }, [session]);

  if (available === null) return null;

  async function reveal() {
    setBusy(true);
    setError(null);
    try {
      const c = await getLandlordContact(propertyId);
      if (!c) setError('Contact details are no longer available for this property.');
      setContact(c);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  const digits = contact?.phone.replace(/[^0-9]/g, '') ?? '';

  return (
    <Card accent style={{ gap: space.md }}>
      <View style={{ gap: 2 }}>
        <Overline>Contact the landlord</Overline>
        <T weight="semibold" size={16}>
          Arrange a viewing directly
        </T>
        <T size={12} color={colors.muted} style={{ lineHeight: 18 }}>
          FindMyHome shares the landlord’s number so you can enquire and arrange a viewing yourself. FindMyHome is
          not a party to any agreement between you and the landlord. Never pay a deposit before viewing the property.
        </T>
      </View>

      {!available ? (
        <T size={13} color={colors.muted}>
          Contact details are not yet available for this property.
        </T>
      ) : !session ? (
        <>
          <T size={13} color={colors.muted}>
            For the landlord’s privacy, contact details are shown only to signed-in users.
          </T>
          <Button title="Sign in to view contact details" icon="lock-closed-outline" onPress={() => router.push('/auth/login')} />
        </>
      ) : contact ? (
        <>
          <Divider />
          <KeyValue label="Landlord" value={contact.landlord_name} />
          <KeyValue label="Phone" value={contact.phone} />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button title="Call" icon="call-outline" compact onPress={() => Linking.openURL(`tel:${digits.startsWith('0') ? digits : `+${digits}`}`)} />
            </View>
            {contact.whatsapp ? (
              <View style={{ flex: 1 }}>
                <Button
                  title="WhatsApp"
                  icon="logo-whatsapp"
                  variant="secondary"
                  compact
                  onPress={() => Linking.openURL(`https://wa.me/${digits}`)}
                />
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Button
                title={copied ? 'Copied' : 'Copy'}
                icon={copied ? 'checkmark' : 'copy-outline'}
                variant="secondary"
                compact
                onPress={async () => {
                  await Clipboard.setStringAsync(contact.phone);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              />
            </View>
          </View>
        </>
      ) : (
        <Button title="Show contact details" icon="call-outline" onPress={reveal} loading={busy} />
      )}
      <ErrorText message={error} />
    </Card>
  );
}

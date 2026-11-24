import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import type { PickedFile, PropertyInput } from '@/lib/api';
import { colors, radius, space } from '@/theme';

import { PropertyImage } from './PropertyImage';
import { Button, Card, Divider, ErrorText, Field, Overline, RadioGroup, T } from './ui';

export interface PropertyFormValues extends PropertyInput {
  photoUrl: string | null;
}

export const emptyProperty: PropertyFormValues = {
  name: '',
  address: '',
  neighborhoodName: '',
  landlordName: '',
  landlordPhone: '',
  landlordWhatsapp: true,
  monthlyRentRwf: null,
  furnished: null,
  isPublished: true,
  photoUrl: null,
};

function SwitchRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
      <View style={{ flex: 1 }}>
        <T size={14}>{label}</T>
        {hint ? (
          <T size={12} color={colors.muted}>
            {hint}
          </T>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.raised}
      />
    </View>
  );
}

/** Add / edit property form (admin). Validates, then hands the values and any new photo to `onSave`. */
export function PropertyForm({
  initial,
  submitLabel,
  showListing,
  onSave,
}: {
  initial: PropertyFormValues;
  submitLabel: string;
  showListing?: boolean;
  onSave: (values: PropertyInput, photo: PickedFile | null) => Promise<void>;
}) {
  const [v, setV] = useState<PropertyFormValues>(initial);
  const [rent, setRent] = useState(initial.monthlyRentRwf != null ? String(initial.monthlyRentRwf) : '');
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof PropertyFormValues>(k: K, value: PropertyFormValues[K]) => setV((p) => ({ ...p, [k]: value }));

  async function pickPhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (res.canceled) return;
    const a = res.assets[0];
    setPhoto({ uri: a.uri, name: a.fileName ?? 'photo.jpg', mimeType: a.mimeType ?? 'image/jpeg' });
  }

  async function save() {
    setError(null);
    if (!v.name.trim()) return setError('Please enter the name of the property.');
    const rentNum = rent.trim() ? Number(rent.replace(/[^0-9]/g, '')) : null;
    if (rent.trim() && (!rentNum || rentNum < 0)) return setError('Monthly rent should be a whole number in RWF, e.g. 150000.');
    const phone = v.landlordPhone.trim();
    if (phone && !v.landlordName.trim()) return setError('Please enter the landlord’s name to store a phone number.');
    if (phone && !/^\+?[0-9 ]{7,20}$/.test(phone))
      return setError('Please enter the phone number in international format, e.g. +250 788 123 456.');
    setBusy(true);
    try {
      await onSave({ ...v, landlordPhone: phone, monthlyRentRwf: rentNum }, photo);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: space.lg }}>
      <Pressable onPress={pickPhoto} accessibilityRole="button" accessibilityLabel="Choose cover photo">
        <PropertyImage uri={photo?.uri ?? v.photoUrl} height={190} rounded={radius.lg} />
        <View
          style={{
            position: 'absolute',
            bottom: 12,
            alignSelf: 'center',
            backgroundColor: colors.primary,
            borderRadius: radius.pill,
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
        >
          <T size={12} weight="medium" color={colors.primaryText}>
            {photo || v.photoUrl ? 'Change cover photo' : 'Add cover photo'}
          </T>
        </View>
      </Pressable>

      <Card style={{ gap: space.md }}>
        <Overline>Listing details</Overline>
        <Field label="Property name" value={v.name} onChangeText={(t) => set('name', t)} placeholder="e.g. Sunrise Apartments" />
        <Field label="Address" optional value={v.address} onChangeText={(t) => set('address', t)} placeholder="e.g. KG 9 Ave, Kagugu" />
        <Field
          label="Neighbourhood"
          optional
          value={v.neighborhoodName}
          onChangeText={(t) => set('neighborhoodName', t)}
          placeholder="e.g. Kagugu"
        />
        <Field
          label="Monthly rent (RWF)"
          optional
          value={rent}
          onChangeText={setRent}
          keyboardType="number-pad"
          placeholder="e.g. 150000"
        />
        {showListing ? (
          <>
            <Divider />
            <SwitchRow
              label="Listed in search"
              hint="Turn off to hide this property from students without deleting it."
              value={v.isPublished}
              onChange={(x) => set('isPublished', x)}
            />
          </>
        ) : null}
      </Card>

      <Card style={{ gap: space.md }}>
        <Overline>Landlord</Overline>
        <Field label="Landlord name" optional value={v.landlordName} onChangeText={(t) => set('landlordName', t)} />
        <Field
          label="Landlord phone number"
          optional
          hint="Shown only to signed-in students who request it from the property page. Every request is logged. The number applies to all of this landlord’s properties."
          value={v.landlordPhone}
          onChangeText={(t) => set('landlordPhone', t)}
          keyboardType="phone-pad"
          placeholder="+250 788 123 456"
        />
        {v.landlordPhone.trim() ? (
          <SwitchRow
            label="Reachable on WhatsApp"
            value={v.landlordWhatsapp}
            onChange={(x) => set('landlordWhatsapp', x)}
          />
        ) : null}
      </Card>

      <Card style={{ gap: space.md }}>
        <Overline>Furnishing</Overline>
        <RadioGroup
          options={[
            { value: 'yes', label: 'Furnished' },
            { value: 'no', label: 'Unfurnished' },
            { value: 'unknown', label: 'Not known' },
          ]}
          value={v.furnished == null ? 'unknown' : v.furnished ? 'yes' : 'no'}
          onChange={(x) => set('furnished', x === 'unknown' ? null : x === 'yes')}
        />
      </Card>

      <ErrorText message={error} />
      <Button title={submitLabel} onPress={save} loading={busy} />
    </View>
  );
}

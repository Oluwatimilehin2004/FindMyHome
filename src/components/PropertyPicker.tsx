import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { friendlyError, searchProperties } from '@/lib/api';
import { formatLocation } from '@/lib/labels';
import type { PropertySummary } from '@/lib/types';
import { colors, radius, space } from '@/theme';

import { Button, Card, ErrorText, Field, Overline, T } from './ui';

export type PickedProperty =
  | { kind: 'existing'; id: string; name: string }
  | { kind: 'new'; name: string; address: string };

/** Choose an existing property, or (students only) describe one that is not listed yet. */
export function PropertyPicker({
  value,
  onChange,
  allowNew = true,
}: {
  value: PickedProperty | null;
  onChange: (p: PickedProperty | null) => void;
  allowNew?: boolean;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PropertySummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (value || q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setError(null);
        setResults((await searchProperties(q)).slice(0, 6));
      } catch (e) {
        setError(friendlyError(e));
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, value]);

  if (value?.kind === 'existing') {
    return (
      <Card accent>
        <Overline>Property</Overline>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <T weight="semibold" size={16} style={{ flex: 1 }}>
            {value.name}
          </T>
          <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityRole="button">
            <T size={13} weight="medium" color={colors.muted}>
              Change
            </T>
          </Pressable>
        </View>
      </Card>
    );
  }

  if (value?.kind === 'new') {
    return (
      <Card accent style={{ gap: space.md }}>
        <View style={{ gap: 2 }}>
          <Overline>New property</Overline>
          <T size={12} color={colors.muted}>
            This property is not yet listed. It will appear in search once your review has been verified.
          </T>
        </View>
        <Field label="Property name" value={value.name} onChangeText={(name) => onChange({ ...value, name })} />
        <Field
          label="Address or directions"
          value={value.address}
          onChangeText={(address) => onChange({ ...value, address })}
          placeholder="e.g. KG 9 Ave, Kagugu, blue gate"
        />
        <Button title="Search the listings instead" variant="secondary" compact onPress={() => onChange(null)} />
      </Card>
    );
  }

  return (
    <Card style={{ gap: space.md }}>
      <Overline>Property</Overline>
      <Field
        label="Which property are you reviewing?"
        placeholder="Name, street or neighbourhood"
        value={q}
        onChangeText={setQ}
        autoCorrect={false}
      />
      <ErrorText message={error} />
      {results.length ? (
        <View style={{ gap: space.sm }}>
          {results.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => onChange({ kind: 'existing', id: p.id, name: p.name })}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                padding: space.md,
                borderRadius: radius.md,
                backgroundColor: pressed ? colors.field : colors.raised,
                borderWidth: 1,
                borderColor: colors.border,
              })}
            >
              <Ionicons name="business-outline" size={18} color={colors.muted} />
              <View style={{ flex: 1 }}>
                <T weight="medium">{p.name}</T>
                <T size={12} color={colors.muted}>
                  {formatLocation(p.address, p.neighborhood)}
                </T>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {allowNew && q.trim().length >= 2 ? (
        <Button
          title="The property is not listed"
          variant="secondary"
          compact
          onPress={() => onChange({ kind: 'new', name: q.trim(), address: '' })}
        />
      ) : null}
    </Card>
  );
}

import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { formatLocation, formatRwf } from '@/lib/labels';
import type { PropertySummary } from '@/lib/types';
import { colors, radius, space } from '@/theme';

import { PropertyImage } from './PropertyImage';
import { Card, Stat, T } from './ui';

/** Thin progress line with a percentage (reference: project card progress). */
function RateLine({ label, pct }: { label: string; pct: number | null }) {
  const value = pct == null ? null : Number(pct);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T size={12} color={colors.muted}>
          {label}
        </T>
        <T size={12} weight="medium">
          {value == null ? 'No data' : `${value}%`}
        </T>
      </View>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.field, overflow: 'hidden' }}>
        <View style={{ width: `${value ?? 0}%`, height: 4, borderRadius: 2, backgroundColor: colors.primary }} />
      </View>
    </View>
  );
}

/** Listing card: photo, name and rent, location, then the key verified indicators. */
export function PropertyCard({ property }: { property: PropertySummary }) {
  const count = Number(property.review_count);
  return (
    <Link href={{ pathname: '/property/[id]', params: { id: property.id } }} asChild>
      <Pressable accessibilityRole="link" style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
        <Card style={{ padding: space.sm, gap: 0 }}>
          <PropertyImage uri={property.photo_url} height={160} rounded={radius.md} />
          <View style={{ padding: space.md, gap: space.md }}>
            <View style={{ gap: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
                <T weight="semibold" size={15} numberOfLines={1} style={{ flex: 1 }}>
                  {property.name}
                </T>
                {property.monthly_rent_rwf != null ? (
                  <T weight="medium" size={13}>
                    {formatRwf(property.monthly_rent_rwf, true)}
                  </T>
                ) : null}
              </View>
              <T size={12} color={colors.muted} numberOfLines={1}>
                {formatLocation(property.address, property.neighborhood)}
              </T>
            </View>

            {count > 0 ? (
              <RateLine label="Recommended by tenants" pct={property.recommend_pct} />
            ) : null}

            <View style={{ flexDirection: 'row', gap: space.lg, flexWrap: 'wrap' }}>
              <Stat icon="shield-checkmark-outline" label={count ? `${count} verified review${count === 1 ? '' : 's'}` : 'No reviews yet'} />
              {property.deposit_fair_pct != null ? (
                <Stat icon="wallet-outline" label={`Deposit returned ${property.deposit_fair_pct}%`} />
              ) : property.furnished != null ? (
                <Stat icon="bed-outline" label={property.furnished ? 'Furnished' : 'Unfurnished'} />
              ) : null}
            </View>
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

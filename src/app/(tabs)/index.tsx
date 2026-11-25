import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HelpButton } from '@/components/HelpSheet';
import { NotificationBell } from '@/components/NotificationBell';
import { PropertyCard } from '@/components/PropertyCard';
import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  IconButton,
  Loading,
  PageTitle,
  RoleBadge,
  SearchBar,
  SectionTitle,
  SegmentTabs,
  T,
} from '@/components/ui';
import { friendlyError, searchProperties } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { PropertySummary } from '@/lib/types';
import { colors, radius, space, TAB_BAR_CLEARANCE } from '@/theme';

type Sort = 'reviewed' | 'recommended' | 'rent';

const SORTS: { value: Sort; label: string }[] = [
  { value: 'reviewed', label: 'Most reviewed' },
  { value: 'recommended', label: 'Recommended' },
  { value: 'rent', label: 'Lowest rent' },
];

const AREAS = ['Kagugu', 'Gacuriro', 'Kibagabaga', 'Kimironko', 'Batsinda'];

function sortBy(list: PropertySummary[], s: Sort) {
  const copy = [...list];
  if (s === 'reviewed') copy.sort((a, b) => Number(b.review_count) - Number(a.review_count));
  if (s === 'recommended') copy.sort((a, b) => Number(b.recommend_pct ?? -1) - Number(a.recommend_pct ?? -1));
  if (s === 'rent')
    copy.sort((a, b) => (a.monthly_rent_rwf ?? Number.MAX_SAFE_INTEGER) - (b.monthly_rent_rwf ?? Number.MAX_SAFE_INTEGER));
  return copy;
}

/** Decorative block grid (reference: performance widget). Filled blocks rise to the right. */
function BlockGraphic() {
  const heights = [1, 2, 1, 3, 2, 4, 3, 4];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
      {heights.map((h, c) => (
        <View key={c} style={{ gap: 3 }}>
          {[0, 1, 2, 3].map((r) => {
            const filled = 3 - r < h;
            return (
              <View
                key={r}
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 2,
                  backgroundColor: filled ? colors.primary : colors.field,
                  borderWidth: filled ? 0 : 1,
                  borderColor: colors.border,
                }}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

// FR 2.1 / FR 2.2 — search by name, address or neighbourhood and list results.
export default function ExploreScreen() {
  const { session, profile, isAdmin } = useAuth();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('reviewed');
  const [results, setResults] = useState<PropertySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  const run = useCallback(async (term: string) => {
    const id = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await searchProperties(term);
      if (id === latest.current) setResults(rows);
    } catch (e) {
      if (id === latest.current) setError(friendlyError(e));
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, []);

  // Debounce typing so the server is not called on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => void run(q), 300);
    return () => clearTimeout(t);
  }, [q, run]);

  const sorted = useMemo(() => sortBy(results, sort), [results, sort]);
  const firstName = profile?.full_name?.trim().split(/\s+/)[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <FlatList
        data={sorted}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: TAB_BAR_CLEARANCE }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ gap: space.lg }}>
            <PageTitle
              title={firstName ? `Welcome, ${firstName}` : 'FindMyHome'}
              subtitle="Verified tenant reviews · Kigali"
              badge={isAdmin ? <RoleBadge admin /> : undefined}
              right={
                <>
                  <HelpButton />
                  {session ? (
                    <NotificationBell />
                  ) : (
                    <IconButton icon="person-outline" label="Sign in" onPress={() => router.push('/auth/login')} />
                  )}
                </>
              }
            />

            <SearchBar
              value={q}
              onChangeText={setQ}
              onSubmit={() => void run(q)}
              placeholder="Search property, street or area"
              actionIcon="arrow-forward"
              actionLabel="Search"
              onAction={() => void run(q)}
            />

            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
              <View style={{ flex: 1, gap: space.sm }}>
                <T weight="semibold" size={14}>
                  Know the property before you pay
                </T>
                <T size={12} color={colors.muted}>
                  Each review is checked against evidence of tenancy before publication.
                </T>
                <View style={{ alignSelf: 'flex-start', marginTop: 2 }}>
                  <Button title="Submit a review" compact onPress={() => router.push('/submit')} />
                </View>
              </View>
              <BlockGraphic />
            </Card>

            <FlatList
              horizontal
              data={AREAS}
              keyExtractor={(a) => a}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: space.sm }}
              renderItem={({ item }) => {
                const active = q.trim().toLowerCase() === item.toLowerCase();
                return (
                  <Pressable
                    onPress={() => setQ(active ? '' : item)}
                    style={({ pressed }) => ({
                      paddingHorizontal: space.lg,
                      paddingVertical: 8,
                      borderRadius: radius.pill,
                      backgroundColor: active ? colors.primary : pressed ? colors.field : colors.card,
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.border,
                    })}
                  >
                    <T size={13} weight="medium" color={active ? colors.primaryText : colors.text}>
                      {item}
                    </T>
                  </Pressable>
                );
              }}
            />

            <SegmentTabs options={SORTS} value={sort} onChange={setSort} />

            <SectionTitle title={q.trim() ? `Results for “${q.trim()}”` : 'Properties'} />
            <ErrorText message={error} />
            {loading ? <Loading /> : null}
          </View>
        }
        ListEmptyComponent={
          !loading && !error ? (
            <Card>
              <EmptyState
                icon="search-outline"
                title="No matching properties"
                body="Try another spelling, the street name or the neighbourhood. If you have lived at the property, you may add it when submitting a review."
              />
            </Card>
          ) : undefined
        }
        renderItem={({ item }) => <PropertyCard property={item} />}
      />
    </SafeAreaView>
  );
}
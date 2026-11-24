import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { LandlordContactCard } from '@/components/LandlordContactCard';
import { PropertyImage } from '@/components/PropertyImage';
import { RecommendationBadge, ReviewCard } from '@/components/ReviewCard';
import {
  Badge,
  BlockMeter,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorText,
  IconButton,
  Loading,
  Overline,
  SectionTitle,
  Stat,
  T,
} from '@/components/ui';
import { adminSetPropertyPhoto, friendlyError, getProperty, getPropertyReviews } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatLocation, formatRwf, SECTION_TITLES, SOURCE_LABELS, tally } from '@/lib/labels';
import type { PropertyDetail, PublicReview } from '@/lib/types';
import { colors, radius, shadow, space } from '@/theme';

/** One indicator in the verification summary: label, block meter and "x of y". */
function Indicator({ label, yes, total }: { label: string; yes: number; total: number }) {
  if (!Number(total)) return null;
  return (
    <View style={{ gap: 6, paddingVertical: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
        <T size={13} style={{ flex: 1 }}>
          {label}
        </T>
        <T size={12} weight="medium" color={colors.muted}>
          {tally(yes, total)}
        </T>
      </View>
      <BlockMeter yes={Number(yes)} total={Number(total)} />
    </View>
  );
}

function SummaryGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.xs }}>
      <Overline>{title}</Overline>
      {children}
    </View>
  );
}

// FR 3.1 / FR 3.2 — verified reviews for one property, summarised as a report.
export default function PropertyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { isAdmin } = useAuth();
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const [p, r] = await Promise.all([getProperty(id), getPropertyReviews(id)]);
      setProperty(p);
      setReviews(r);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Reload when returning to this screen (e.g. after an admin edit).
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      void load(!first.current);
      first.current = false;
    }, [load]),
  );

  async function changePhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (res.canceled || !property) return;
    const a = res.assets[0];
    setUploading(true);
    try {
      const url = await adminSetPropertyPhoto(property.id, {
        uri: a.uri,
        name: a.fileName ?? 'photo.jpg',
        mimeType: a.mimeType ?? 'image/jpeg',
      });
      setProperty({ ...property, photo_url: url });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setUploading(false);
    }
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <Loading />
      </SafeAreaView>
    );
  }

  if (!property) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: space.lg, gap: space.lg }}>
        <IconButton icon="arrow-back" onPress={back} label="Back" />
        {error ? (
          <>
            <ErrorText message={error} />
            <Button title="Try again" variant="secondary" onPress={() => load()} />
          </>
        ) : (
          <Card>
            <EmptyState title="Property not found" body="This property may have been removed or is not yet published." />
          </Card>
        )}
      </SafeAreaView>
    );
  }

  const count = reviews.length;
  const p = property;
  const writeReview = () => router.push({ pathname: '/submit', params: { propertyId: p.id, propertyName: p.name } });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 + insets.bottom }} showsVerticalScrollIndicator={false}>
        {/* Cover */}
        <View style={{ padding: space.lg, paddingTop: insets.top + space.sm }}>
          <View>
            <PropertyImage uri={p.photo_url} height={300} rounded={radius.xl} />
            <View style={{ position: 'absolute', top: space.md, left: space.md }}>
              <IconButton icon="arrow-back" onPress={back} label="Back" />
            </View>
            {isAdmin ? (
              <View style={{ position: 'absolute', top: space.md, right: space.md, flexDirection: 'row', gap: space.sm }}>
                <IconButton
                  icon={uploading ? 'hourglass-outline' : 'camera-outline'}
                  onPress={changePhoto}
                  label="Change cover photo"
                />
                <IconButton
                  icon="create-outline"
                  onPress={() => router.push({ pathname: '/admin/edit-property/[id]', params: { id: p.id } })}
                  label="Edit property"
                />
              </View>
            ) : null}
          </View>
        </View>

        <View style={{ paddingHorizontal: space.lg, gap: space.lg }}>
          {/* Title block */}
          <View style={{ gap: space.sm }}>
            <T weight="semibold" size={22} style={{ letterSpacing: -0.3 }}>
              {p.name}
            </T>
            <T size={13} color={colors.muted}>
              {formatLocation(p.address, p.neighborhood)}
            </T>
            <View style={{ flexDirection: 'row', gap: space.lg, flexWrap: 'wrap', marginTop: 2 }}>
              <Stat icon="shield-checkmark-outline" label={`${count} verified review${count === 1 ? '' : 's'}`} />
              {p.furnished != null ? <Stat icon="bed-outline" label={p.furnished ? 'Furnished' : 'Unfurnished'} /> : null}
              {p.landlord_name ? <Stat icon="person-outline" label={p.landlord_name} /> : null}
            </View>
          </View>

          <ErrorText message={error} />

          {/* Verification summary */}
          {count > 0 ? (
            <Card style={{ gap: space.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.md }}>
                <View style={{ flex: 1 }}>
                  <T weight="semibold" size={16}>
                    Verification summary
                  </T>
                  <T size={12} color={colors.muted}>
                    Based on {Number(p.review_count)} verified review{Number(p.review_count) === 1 ? '' : 's'}
                  </T>
                </View>
                {p.recommend_pct != null ? (
                  <View style={{ alignItems: 'flex-end' }}>
                    <T weight="semibold" size={22}>
                      {p.recommend_pct}%
                    </T>
                    <T size={11} color={colors.muted}>
                      recommend
                    </T>
                  </View>
                ) : null}
              </View>
              <Divider />
              <SummaryGroup title={SECTION_TITLES.listing}>
                <Indicator label="Property as advertised" yes={p.accuracy_as_advertised} total={p.accuracy_answered} />
              </SummaryGroup>
              <SummaryGroup title={SECTION_TITLES.deposit}>
                <Indicator label="Deposit returned in full" yes={p.deposit_full} total={p.deposit_decided} />
                {!Number(p.deposit_decided) ? (
                  <T size={12} color={colors.muted}>
                    No completed tenancies reported yet.
                  </T>
                ) : null}
              </SummaryGroup>
              <SummaryGroup title={SECTION_TITLES.landlord}>
                <Indicator label="Honoured the written agreement" yes={p.agreement_yes} total={p.agreement_answered} />
                <Indicator label="Handled repairs within a reasonable time" yes={p.repairs_yes} total={p.repairs_answered} />
                <Indicator label="Gave proper notice" yes={p.notice_yes} total={p.notice_answered} />
                <Indicator label="Communicated respectfully" yes={p.respect_yes} total={p.respect_answered} />
              </SummaryGroup>
              <SummaryGroup title={SECTION_TITLES.area}>
                <Indicator label="Felt safe" yes={p.safety_safe} total={p.safety_answered} />
                <Indicator label="Quiet surroundings" yes={p.noise_quiet} total={p.noise_answered} />
                <Indicator label="Reliable water and electricity" yes={p.utilities_reliable} total={p.utilities_answered} />
              </SummaryGroup>
            </Card>
          ) : null}

          <SectionTitle title={`Verified reviews${count ? ` (${count})` : ''}`} />

          {count === 0 ? (
            <Card>
              <EmptyState
                icon="document-text-outline"
                title="No verified reviews yet"
                body="No tenant has submitted a verified review of this property. If you have lived here, your review will help the next student."
              />
            </Card>
          ) : (
            reviews.map((r) => (
              <ReviewCard
                key={r.id}
                review={r}
                header={
                  <View style={{ gap: space.sm }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
                      <T weight="semibold" size={14}>
                        {r.is_current_tenant
                          ? 'Current tenant'
                          : r.lived_there_year
                            ? `Tenant, ${r.lived_there_year}`
                            : 'Former tenant'}
                      </T>
                      <Badge
                        icon="shield-checkmark"
                        label={SOURCE_LABELS[r.source]}
                        tone={r.source === 'admin_manual' ? 'info' : 'neutral'}
                      />
                    </View>
                    <RecommendationBadge value={r.recommendation} />
                    <Divider style={{ marginTop: space.xs }} />
                  </View>
                }
              />
            ))
          )}

          <LandlordContactCard propertyId={p.id} />
        </View>
      </ScrollView>

      {/* Bottom bar */}
      <View
        style={[
          {
            position: 'absolute',
            left: space.lg,
            right: space.lg,
            bottom: insets.bottom + space.md,
            backgroundColor: colors.card,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: colors.hairline,
            padding: 6,
            paddingLeft: space.xl,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          },
          shadow,
        ]}
      >
        <View>
          <T weight="semibold" size={15}>
            {p.monthly_rent_rwf != null ? formatRwf(p.monthly_rent_rwf, true) : 'Rent not reported'}
          </T>
          <T size={11} color={colors.muted}>
            {p.monthly_rent_rwf != null ? 'Reported monthly rent' : 'Listing information'}
          </T>
        </View>
        <Button title="Review this property" icon="create-outline" onPress={writeReview} compact />
      </View>
    </View>
  );
}

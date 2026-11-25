import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HelpButton } from '@/components/HelpSheet';
import { NotificationBell } from '@/components/NotificationBell';
import { PropertyImage } from '@/components/PropertyImage';
import { RecommendationBadge, ReviewRecordView } from '@/components/ReviewCard';
import {
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorText,
  IconButton,
  Loading,
  Overline,
  PageTitle,
  RoleBadge,
  SegmentTabs,
  T,
  type Tone,
} from '@/components/ui';
import { friendlyError, getMyReviews, type MyReview } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatMonth, formatRef, STATUS_LABELS } from '@/lib/labels';
import type { ReviewStatus } from '@/lib/types';
import { colors, radius, space, TAB_BAR_CLEARANCE } from '@/theme';

type Filter = 'all' | ReviewStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'In review' },
  { value: 'approved', label: 'Published' },
  { value: 'rejected', label: 'Declined' },
];

const TONE: Record<ReviewStatus, Tone> = { pending: 'warn', approved: 'ok', rejected: 'danger' };
const BAR: Record<ReviewStatus, string> = { pending: colors.warn, approved: colors.primary, rejected: colors.danger };

/** Vertical status timeline (reference: schedule time column). */
function Timeline({ review }: { review: MyReview }) {
  const decided = review.status !== 'pending';
  const steps: { label: string; detail: string; state: 'done' | 'current' | 'upcoming' | 'failed' }[] = [
    { label: 'Submitted', detail: formatDate(review.created_at), state: 'done' },
    {
      label: 'Under verification',
      detail: decided ? 'Completed' : 'Evidence is being examined (target: 48 hours)',
      state: decided ? 'done' : 'current',
    },
    review.status === 'rejected'
      ? { label: 'Not approved', detail: formatDate(review.reviewed_at), state: 'failed' }
      : {
          label: 'Published',
          detail: review.status === 'approved' ? formatDate(review.reviewed_at) : 'Awaiting decision',
          state: review.status === 'approved' ? 'done' : 'upcoming',
        },
  ];

  return (
    <View>
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const dot =
          s.state === 'done' ? colors.primary : s.state === 'current' ? colors.warn : s.state === 'failed' ? colors.danger : colors.border;
        return (
          <View key={s.label} style={{ flexDirection: 'row', gap: space.md }}>
            <View style={{ alignItems: 'center', width: 14 }}>
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  marginTop: 3,
                  backgroundColor: s.state === 'upcoming' ? colors.card : dot,
                  borderWidth: 2,
                  borderColor: dot,
                }}
              />
              {!last ? <View style={{ flex: 1, width: 1.5, backgroundColor: colors.border, marginVertical: 2 }} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: last ? 0 : space.md }}>
              <T size={13} weight="medium" color={s.state === 'upcoming' ? colors.muted : colors.text}>
                {s.label}
              </T>
              <T size={12} color={colors.muted}>
                {s.detail}
              </T>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function SubmissionCard({ review, open, onToggle }: { review: MyReview; open: boolean; onToggle: () => void }) {
  return (
    <Card accent={BAR[review.status]} style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Overline>Ref. {formatRef(review.ref_no, review.created_at)}</Overline>
        <Badge label={STATUS_LABELS[review.status]} tone={TONE[review.status]} />
      </View>

      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        <PropertyImage uri={review.property?.photo_url} height={48} rounded={radius.sm} style={{ width: 48 }} />
        <View style={{ flex: 1 }}>
          <T weight="semibold" size={15} numberOfLines={1}>
            {review.property?.name ?? 'Property'}
          </T>
          <T size={12} color={colors.muted} numberOfLines={1}>
            Tenancy {formatMonth(review.tenancy_start)} – {review.tenancy_end ? formatMonth(review.tenancy_end) : 'present'}
          </T>
        </View>
      </View>

      <Divider />
      <Timeline review={review} />

      {review.status === 'rejected' && review.rejection_reason ? (
        <View style={{ backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: space.md, gap: 2 }}>
          <Overline>Reason for decision</Overline>
          <T size={13} color={colors.danger} style={{ lineHeight: 19 }}>
            {review.rejection_reason}
          </T>
        </View>
      ) : null}

      <Pressable
        onPress={onToggle}
        hitSlop={6}
        accessibilityRole="button"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
      >
        <T size={13} weight="medium">
          {open ? 'Hide submission' : 'View submission'}
        </T>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.text} />
      </Pressable>

      {open ? (
        <View style={{ gap: space.md }}>
          <RecommendationBadge value={review.recommendation} />
          <ReviewRecordView review={review} />
        </View>
      ) : null}
    </Card>
  );
}

// Use case "Track review status" / sequence diagram step 7.
export default function MyReviewsScreen() {
  const { session, profile, signOut, isAdmin } = useAuth();
  const [reviews, setReviews] = useState<MyReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      setReviews(await getMyReviews(session.user.id));
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 };
    reviews?.forEach((r) => (c[r.status] += 1));
    return c;
  }, [reviews]);

  const visible = useMemo(
    () => (reviews ?? []).filter((r) => filter === 'all' || r.status === filter),
    [reviews, filter],
  );

  if (!session) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
        <View style={{ padding: space.lg, gap: space.lg }}>
          <PageTitle title="My reviews" subtitle="Submissions and verification status" right={<HelpButton />} />
          <Card accent style={{ gap: space.md }}>
            <T weight="semibold" size={16}>
              Sign in to view your submissions
            </T>
            <T size={13} color={colors.muted}>
              Your submitted reviews and their verification status are shown here once you are signed in.
            </T>
            <Button title="Sign in" onPress={() => router.push('/auth/login')} />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  const name = profile?.full_name || session.user.email || '';
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: TAB_BAR_CLEARANCE }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <PageTitle
          title="My reviews"
          subtitle="Submissions and verification status"
          right={
            <>
              <HelpButton />
              <NotificationBell />
              <IconButton icon="log-out-outline" label="Sign out" onPress={signOut} />
            </>
          }
        />

        <Card style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <T weight="semibold" color={colors.primaryText}>
                {initials || '•'}
              </T>
            </View>
            <View style={{ flex: 1 }}>
              <T weight="semibold" numberOfLines={1}>
                {profile?.full_name || (isAdmin ? 'Administrator' : 'Student')}
              </T>
              <T size={12} color={colors.muted} numberOfLines={1}>
                {session.user.email}
              </T>
              <View style={{ marginTop: 6 }}>
                <RoleBadge admin={isAdmin} />
              </View>
            </View>
          </View>
          <Divider />
          <View style={{ flexDirection: 'row' }}>
            {[
              ['Submitted', reviews?.length ?? 0],
              ['In review', counts.pending],
              ['Published', counts.approved],
            ].map(([label, n], i) => (
              <View key={label} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i ? 1 : 0, borderLeftColor: colors.border }}>
                <T weight="semibold" size={18}>
                  {n}
                </T>
                <T size={11} color={colors.muted}>
                  {label}
                </T>
              </View>
            ))}
          </View>
        </Card>

        <SegmentTabs options={FILTERS} value={filter} onChange={setFilter} />

        <ErrorText message={error} />
        {reviews === null && !error ? <Loading /> : null}

        {reviews?.length === 0 ? (
          <Card style={{ gap: space.md }}>
            <EmptyState
              icon="document-text-outline"
              title="No submissions yet"
              body="Reviews you submit will appear here together with their verification status."
            />
            <Button title="Submit a review" onPress={() => router.push('/submit')} />
          </Card>
        ) : null}

        {reviews?.length && !visible.length ? (
          <T size={13} color={colors.muted} style={{ textAlign: 'center' }}>
            No submissions in this category.
          </T>
        ) : null}

        {visible.map((r) => (
          <SubmissionCard
            key={r.id}
            review={r}
            open={expanded === r.id}
            onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
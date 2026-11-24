import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HelpButton } from '@/components/HelpSheet';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorText,
  Loading,
  Notice,
  Overline,
  PageTitle,
  SectionTitle,
  SegmentTabs,
  T,
  type IconName,
} from '@/components/ui';
import {
  friendlyError,
  getDecisionHistory,
  getPendingReviews,
  getStaleEvidenceFiles,
  removeEvidenceFiles,
  type QueueReview,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatRef, SOURCE_LABELS } from '@/lib/labels';
import { colors, radius, space, TAB_BAR_CLEARANCE } from '@/theme';

type View_ = 'pending' | 'history';

function hoursSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
}

function ToolCard({ icon, title, body, onPress }: { icon: IconName; title: string; body: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}>
      <Card style={{ gap: space.sm, minHeight: 128 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.md,
            backgroundColor: colors.raised,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={18} color={colors.text} />
        </View>
        <T weight="semibold" size={14}>
          {title}
        </T>
        <T size={12} color={colors.muted}>
          {body}
        </T>
      </Card>
    </Pressable>
  );
}

function PendingCard({ r, mine }: { r: QueueReview; mine: boolean }) {
  const age = hoursSince(r.created_at);
  const tone = age >= 48 ? 'danger' : age >= 24 ? 'warn' : 'neutral';
  const bar = age >= 48 ? colors.danger : age >= 24 ? colors.warn : colors.primary;
  return (
    <Link href={{ pathname: '/admin/review/[id]', params: { id: r.id } }} asChild>
      <Pressable>
        <Card accent={bar} style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Overline>Ref. {formatRef(r.ref_no, r.created_at)}</Overline>
            <Badge label={age < 1 ? 'Received now' : `Waiting ${age} h`} tone={tone} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <T weight="semibold" size={15}>
                {r.property?.name ?? 'Unknown property'}
              </T>
              <T size={12} color={colors.muted}>
                {r.author?.full_name || 'Unknown reviewer'} · {r.proofs.length} evidence file
                {r.proofs.length === 1 ? '' : 's'} · {formatDate(r.created_at)}
              </T>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </View>
          {mine ? <Badge label="Your submission — another team member must verify it" tone="info" icon="person-outline" /> : null}
        </Card>
      </Pressable>
    </Link>
  );
}

function HistoryCard({ r }: { r: QueueReview }) {
  const approved = r.status === 'approved';
  const removed = r.proofs.length > 0 && r.proofs.every((p) => p.file_removed_at);
  return (
    <Link href={{ pathname: '/admin/review/[id]', params: { id: r.id } }} asChild>
      <Pressable>
        <Card accent={approved ? colors.ok : colors.danger} style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Overline>Ref. {formatRef(r.ref_no, r.created_at)}</Overline>
            <Badge label={approved ? 'Approved' : 'Declined'} tone={approved ? 'ok' : 'danger'} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T weight="semibold" size={15}>
                {r.property?.name ?? 'Unknown property'}
              </T>
              <T size={12} color={colors.muted}>
                {r.source === 'admin_manual'
                  ? `${SOURCE_LABELS.admin_manual} · entered ${formatDate(r.reviewed_at)}`
                  : `${r.author?.full_name || 'Unknown reviewer'} · ${approved ? 'approved' : 'declined'} by ${
                      r.reviewer?.full_name || 'team member'
                    } on ${formatDate(r.reviewed_at)}`}
              </T>
              {!approved && r.rejection_reason ? (
                <T size={12} color={colors.danger} numberOfLines={2}>
                  Reason: {r.rejection_reason}
                </T>
              ) : null}
              {removed ? (
                <T size={11} color={colors.muted}>
                  Evidence removed
                </T>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

/** Finds evidence files that should no longer be kept and removes them on confirmation. */
function EvidenceCleanup() {
  const [stale, setStale] = useState<{ path: string; reason: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setStale(await getStaleEvidenceFiles());
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!stale?.length) return;
    setBusy(true);
    setError(null);
    try {
      const n = await removeEvidenceFiles(stale.map((s) => s.path));
      setResult(`${n} file${n === 1 ? '' : 's'} removed from storage.`);
      setStale([]);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  const declined = stale?.filter((s) => s.reason === 'Review declined').length ?? 0;
  const orphaned = (stale?.length ?? 0) - declined;

  return (
    <Card style={{ gap: space.md }}>
      <View style={{ gap: 2 }}>
        <Overline>Evidence storage</Overline>
        <T weight="semibold" size={15}>
          Remove evidence that is no longer needed
        </T>
        <T size={12} color={colors.muted}>
          Evidence of declined reviews, and files not attached to any review, should not be kept (Rwanda Data
          Protection Law, 2021). Evidence of declined reviews is removed automatically when you decline.
        </T>
      </View>
      {stale === null ? (
        <Button title="Check storage" variant="secondary" compact icon="search-outline" onPress={check} loading={busy} />
      ) : stale.length === 0 ? (
        <Notice tone="ok">{result ?? 'No evidence files need to be removed.'}</Notice>
      ) : (
        <>
          <T size={13}>
            {stale.length} file{stale.length === 1 ? '' : 's'} found: {declined} from declined reviews, {orphaned} without a
            review.
          </T>
          <Button title={`Remove ${stale.length} file${stale.length === 1 ? '' : 's'}`} variant="danger" compact onPress={remove} loading={busy} />
        </>
      )}
      <ErrorText message={error} />
    </Card>
  );
}

// FR 5 — Platform administrator: verification queue, decision history and team tools.
export default function AdminQueue() {
  const { isAdmin, session } = useAuth();
  const [tab, setTab] = useState<View_>('pending');
  const [queue, setQueue] = useState<QueueReview[] | null>(null);
  const [history, setHistory] = useState<QueueReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [q, h] = await Promise.all([getPendingReviews(), getDecisionHistory()]);
      setQueue(q);
      setHistory(h);
    } catch (e) {
      setError(friendlyError(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isAdmin) void load();
    }, [isAdmin, load]),
  );

  if (!isAdmin) return <Redirect href="/" />;

  const uid = session?.user.id;
  const overdue = queue?.filter((r) => hoursSince(r.created_at) >= 48).length ?? 0;

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
        <PageTitle title="Verification" subtitle="FindMyHome team workspace" right={<HelpButton />} />

        <View style={{ flexDirection: 'row', gap: space.md }}>
          <ToolCard
            icon="create-outline"
            title="Add early review"
            body="Enter a review collected and verified in person."
            onPress={() => router.push('/admin/add-review')}
          />
          <ToolCard
            icon="business-outline"
            title="Add property"
            body="Create a listing with address, landlord and photo."
            onPress={() => router.push('/admin/add-property')}
          />
        </View>

        <SegmentTabs
          options={[
            { value: 'pending', label: `Pending${queue ? ` (${queue.length})` : ''}` },
            { value: 'history', label: 'Decision history' },
          ]}
          value={tab}
          onChange={setTab}
        />

        <ErrorText message={error} />

        {tab === 'pending' ? (
          <>
            {overdue > 0 ? <Badge icon="alert-circle-outline" label={`${overdue} past the 48-hour target`} tone="danger" /> : null}
            {queue === null && !error ? <Loading /> : null}
            {queue?.length === 0 ? (
              <Card>
                <EmptyState icon="checkmark-done-outline" title="Queue clear" body="No reviews are awaiting verification." />
              </Card>
            ) : null}
            {queue?.map((r) => <PendingCard key={r.id} r={r} mine={!!uid && r.author_id === uid} />)}
          </>
        ) : (
          <>
            <EvidenceCleanup />
            <SectionTitle title={`Recent decisions${history ? ` (${history.length})` : ''}`} />
            {history === null && !error ? <Loading /> : null}
            {history?.length === 0 ? (
              <Card>
                <EmptyState icon="time-outline" title="No decisions yet" body="Approved and declined reviews will appear here." />
              </Card>
            ) : null}
            {history?.map((r) => <HistoryCard key={r.id} r={r} />)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

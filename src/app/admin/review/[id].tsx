import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecommendationBadge, ReviewRecordView } from '@/components/ReviewCard';
import {
  Badge,
  Button,
  Card,
  Divider,
  ErrorText,
  Field,
  KeyValue,
  Loading,
  Notice,
  Overline,
  Screen,
  T,
  TopBar,
} from '@/components/ui';
import {
  friendlyError,
  getProofUrl,
  getReviewForAdmin,
  moderateReview,
  removeEvidenceFiles,
  type QueueReview,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatMonth, formatRef, PROOF_LABELS, SOURCE_LABELS, STATUS_LABELS } from '@/lib/labels';
import { colors, space } from '@/theme';

// FR 5.1 — examine a submission and its evidence, then approve or decline (sequence diagram alt fragment).
export default function VerifyReview() {
  const { isAdmin, session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [review, setReview] = useState<QueueReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [openedProof, setOpenedProof] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReview(await getReviewForAdmin(id));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isAdmin) return <Redirect href="/" />;
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar title="Verify review" />
        <Loading />
      </SafeAreaView>
    );
  }
  if (!review) {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']} header={<TopBar title="Verify review" />}>
        <ErrorText message={error ?? 'This review could not be found.'} />
      </Screen>
    );
  }

  const pending = review.status === 'pending';
  const mine = !!session && review.author_id === session.user.id;
  const liveProofs = review.proofs.filter((p) => !p.file_removed_at);

  async function openProof(path: string) {
    try {
      await Linking.openURL(await getProofUrl(path));
      setOpenedProof(true);
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  async function decide(approve: boolean) {
    setError(null);
    if (!approve && !reason.trim()) {
      setError('Please state the reason for declining. It will be shown to the reviewer.');
      return;
    }
    setBusy(approve ? 'approve' : 'reject');
    try {
      await moderateReview(review!.id, approve, approve ? undefined : reason.trim());
      if (!approve) {
        // Evidence of a declined review is not kept. If removal fails, the clean-up in
        // Decision history will find the file later.
        await removeEvidenceFiles(liveProofs.map((p) => p.storage_path)).catch(() => undefined);
      }
      router.back();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} header={<TopBar title={pending ? 'Verify review' : 'Review record'} />}>
      <Card accent style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Overline>Ref. {formatRef(review.ref_no, review.created_at)}</Overline>
          <Badge
            label={STATUS_LABELS[review.status]}
            tone={pending ? 'warn' : review.status === 'approved' ? 'ok' : 'danger'}
          />
        </View>
        <T weight="semibold" size={18}>
          {review.property?.name ?? 'Unknown property'}
        </T>
        {review.property?.address ? (
          <T size={13} color={colors.muted}>
            {review.property.address}
          </T>
        ) : null}
      </Card>

      {!pending ? (
        <Card style={{ gap: 0 }}>
          <Overline>Decision</Overline>
          <KeyValue label="Outcome" value={review.status === 'approved' ? 'Approved and published' : 'Declined'} />
          <KeyValue
            label={review.source === 'admin_manual' ? 'Entered by' : 'Decided by'}
            value={review.source === 'admin_manual' ? SOURCE_LABELS.admin_manual : review.reviewer?.full_name || 'Team member'}
          />
          <KeyValue label="Date" value={formatDate(review.reviewed_at)} />
          {review.rejection_reason ? (
            <View style={{ paddingTop: space.sm, gap: 2 }}>
              <T size={13} color={colors.muted}>
                Reason given to the reviewer
              </T>
              <T size={13} color={colors.danger}>
                {review.rejection_reason}
              </T>
            </View>
          ) : null}
        </Card>
      ) : null}

      {review.source === 'student' ? (
        <Card style={{ gap: 0 }}>
          <Overline>Reviewer (team only)</Overline>
          <KeyValue label="Name" value={review.author?.full_name || 'Unknown'} />
          <KeyValue label="Institution" value={review.author?.university} />
          <KeyValue
            label="Stated tenancy"
            value={`${formatMonth(review.tenancy_start)} – ${review.tenancy_end ? formatMonth(review.tenancy_end) : 'present'}`}
          />
          <KeyValue label="Submitted" value={formatDate(review.created_at)} />
        </Card>
      ) : null}

      {review.source === 'student' ? (
        <Card style={{ gap: space.md }}>
          <Overline>Evidence of tenancy</Overline>
          {review.proofs.length === 0 ? (
            <T size={13} color={colors.danger}>
              No evidence attached. This review cannot be approved.
            </T>
          ) : (
            review.proofs.map((p) =>
              p.file_removed_at ? (
                <T key={p.id} size={13} color={colors.muted}>
                  {PROOF_LABELS[p.proof_type]}: removed from storage on {formatDate(p.file_removed_at)}.
                </T>
              ) : (
                <Button
                  key={p.id}
                  title={`Open ${PROOF_LABELS[p.proof_type].toLowerCase()}`}
                  variant="secondary"
                  icon="document-outline"
                  onPress={() => openProof(p.storage_path)}
                />
              ),
            )
          )}
          {liveProofs.length ? (
            <T size={12} color={colors.muted}>
              Confirm that the name, address and dates on the document correspond to this submission. Links expire after
              five minutes.
            </T>
          ) : null}
        </Card>
      ) : null}

      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Overline>Assessment</Overline>
          <RecommendationBadge value={review.recommendation} />
        </View>
        <Divider />
        <ReviewRecordView review={review} />
      </Card>

      {pending && mine ? (
        <Notice>You submitted this review. To keep verification independent, another member of the team must verify it.</Notice>
      ) : null}

      {pending && !mine ? (
        <>
          {!openedProof && liveProofs.length > 0 ? (
            <Notice tone="warn">Open the evidence document before approving this review.</Notice>
          ) : null}
          <Field
            label="Reason for declining"
            hint="Required only when declining. The reviewer is notified and sees this under My reviews. The evidence file is then deleted."
            value={reason}
            onChangeText={setReason}
            multiline
            placeholder="e.g. The tenancy agreement refers to a different address."
          />
          <ErrorText message={error} />
          <Button
            title="Approve and publish"
            icon="checkmark"
            onPress={() => decide(true)}
            loading={busy === 'approve'}
            disabled={busy !== null || liveProofs.length === 0 || !openedProof}
          />
          <Button
            title="Decline"
            variant="danger"
            onPress={() => decide(false)}
            loading={busy === 'reject'}
            disabled={busy !== null}
          />
        </>
      ) : (
        <ErrorText message={error} />
      )}
    </Screen>
  );
}

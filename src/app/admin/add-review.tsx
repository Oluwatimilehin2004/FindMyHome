import { Redirect, router } from 'expo-router';
import { useState } from 'react';

import { PropertyPicker, type PickedProperty } from '@/components/PropertyPicker';
import { emptyReviewForm, ReviewForm, toDraft, type ReviewFormState } from '@/components/ReviewForm';
import { Button, Card, ErrorText, Field, Notice, Overline, Screen, T, TopBar } from '@/components/ui';
import { adminAddReview, friendlyError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, space } from '@/theme';

// FR 5.2 — the team enters a review collected and verified through direct outreach.
export default function AddEarlyReview() {
  const { isAdmin } = useAuth();
  const [property, setProperty] = useState<PickedProperty | null>(null);
  const [form, setForm] = useState<ReviewFormState>(emptyReviewForm);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(0);

  if (!isAdmin) return <Redirect href="/" />;

  async function save() {
    setError(null);
    if (property?.kind !== 'existing') return setError('Select an existing property. Add the property first if it is not listed.');
    const result = toDraft(form);
    if ('error' in result) return setError(result.error);
    if (!note.trim()) return setError('Section 7: record how and when this review was collected.');
    setBusy(true);
    try {
      await adminAddReview(property.id, result.draft, note.trim());
      setForm(emptyReviewForm);
      setNote('');
      setSaved((n) => n + 1);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} header={<TopBar title="Add early review" />}>
      <Notice>
        Enter only reviews from tenants whose tenancy you have verified in person. These reviews are published
        immediately and labelled “Verified by FindMyHome”.
      </Notice>
      {saved > 0 ? (
        <Notice tone="ok">
          {saved} review{saved === 1 ? '' : 's'} published in this session.
        </Notice>
      ) : null}
      <PropertyPicker value={property} onChange={setProperty} allowNew={false} />
      <Button title="Property not listed? Add it first" variant="secondary" compact onPress={() => router.push('/admin/add-property')} />
      <ReviewForm value={form} onChange={setForm} />
      <Card style={{ gap: space.md }}>
        <Overline>Section 07</Overline>
        <T weight="semibold" size={16}>
          Collection record
        </T>
        <T size={12} color={colors.muted}>
          Stored in the audit log and visible to the team only.
        </T>
        <Field
          label="How and when was this review collected?"
          placeholder="e.g. Interviewed in person on 12 Nov 2026; signed tenancy agreement sighted."
          value={note}
          onChangeText={setNote}
          multiline
        />
      </Card>
      <ErrorText message={error} />
      <Button title="Publish review" onPress={save} loading={busy} />
    </Screen>
  );
}

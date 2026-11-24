import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { HelpButton } from '@/components/HelpSheet';
import { PropertyPicker, type PickedProperty } from '@/components/PropertyPicker';
import { emptyReviewForm, ReviewForm, toDraft, type ReviewFormState } from '@/components/ReviewForm';
import {
  Button,
  Card,
  CheckGroup,
  Divider,
  ErrorText,
  KeyValue,
  Notice,
  Overline,
  PageTitle,
  RadioGroup,
  Screen,
  T,
} from '@/components/ui';
import {
  friendlyError,
  getReviewReference,
  submitReview,
  uploadProof,
  type PickedFile,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatRef, PROOF_LABELS } from '@/lib/labels';
import type { ProofType } from '@/lib/types';
import { colors, space } from '@/theme';

const MAX_PROOF_BYTES = 10 * 1024 * 1024;

interface Receipt {
  reference: string;
  property: string;
  date: string;
}

// FR 4.1 / FR 4.2 — submit a structured review with evidence of tenancy.
export default function SubmitScreen() {
  const { session } = useAuth();
  const params = useLocalSearchParams<{ propertyId?: string; propertyName?: string }>();

  const [property, setProperty] = useState<PickedProperty | null>(null);
  const [form, setForm] = useState<ReviewFormState>(emptyReviewForm);
  const [proofType, setProofType] = useState<ProofType | null>(null);
  const [proof, setProof] = useState<PickedFile | null>(null);
  const [declared, setDeclared] = useState<'confirm'[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  // Arriving from a property page pre-selects that property.
  useEffect(() => {
    if (params.propertyId && params.propertyName) {
      setProperty({ kind: 'existing', id: params.propertyId, name: params.propertyName });
      setReceipt(null);
    }
  }, [params.propertyId, params.propertyName]);

  const header = <PageTitle title="Submit a review" subtitle="Tenancy assessment" right={<HelpButton />} />;

  if (!session) {
    return (
      <Screen edges={['top', 'left', 'right']} tabScreen>
        {header}
        <Card accent style={{ gap: space.md }}>
          <T weight="semibold" size={16}>
            An account is required
          </T>
          <T size={13} color={colors.muted} style={{ lineHeight: 20 }}>
            To keep every published review credible, the FindMyHome team verifies each reviewer’s tenancy. Please
            sign in or create an account to continue. Your name is never published.
          </T>
          <Button title="Sign in" onPress={() => router.push('/auth/login')} />
          <Button title="Create an account" variant="secondary" onPress={() => router.push('/auth/signup')} />
        </Card>
      </Screen>
    );
  }

  if (receipt) {
    return (
      <Screen edges={['top', 'left', 'right']} tabScreen>
        {header}
        <Card accent style={{ gap: space.md }}>
          <Overline>Submission received</Overline>
          <T weight="semibold" size={18}>
            Your review has been submitted for verification
          </T>
          <T size={13} color={colors.muted} style={{ lineHeight: 20 }}>
            The FindMyHome team will examine your evidence of tenancy, normally within 48 hours. You can follow its
            progress under My reviews.
          </T>
          <Divider />
          <KeyValue label="Reference" value={receipt.reference} />
          <KeyValue label="Property" value={receipt.property} />
          <KeyValue label="Date submitted" value={receipt.date} />
          <KeyValue label="Status" value="Under verification" />
        </Card>
        <Button title="View my reviews" onPress={() => router.push('/my-reviews')} />
        <Button
          title="Submit another review"
          variant="secondary"
          onPress={() => {
            setProperty(null);
            setReceipt(null);
          }}
        />
      </Screen>
    );
  }

  async function pickProof() {
    setError(null);
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled) return;
    const a = res.assets[0];
    if (a.size != null && a.size > MAX_PROOF_BYTES) {
      setError('The selected file exceeds 10 MB. Please choose a smaller image or PDF.');
      return;
    }
    setProof({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/octet-stream' });
  }

  async function submit() {
    setError(null);
    if (!property) return setError('Please select the property you are reviewing.');
    if (property.kind === 'new' && !property.name.trim()) return setError('Please enter the name of the property.');
    const result = toDraft(form);
    if ('error' in result) return setError(result.error);
    if (!proofType) return setError('Section 7: select the type of evidence you are providing.');
    if (!proof) return setError('Section 7: attach your evidence of tenancy.');
    if (!declared.length) return setError('Please confirm the declaration before submitting.');

    setBusy(true);
    try {
      const path = await uploadProof(session!.user.id, proof);
      const id = await submitReview({
        ...result.draft,
        propertyId: property.kind === 'existing' ? property.id : null,
        newPropertyName: property.kind === 'new' ? property.name : undefined,
        newPropertyAddress: property.kind === 'new' ? property.address : undefined,
        proofType,
        proofPath: path,
      });
      const ref = await getReviewReference(id).catch(() => null);
      const now = new Date().toISOString();
      setReceipt({
        reference: ref ? formatRef(ref.ref_no, ref.created_at) : 'Pending',
        property: property.name,
        date: formatDate(ref?.created_at ?? now),
      });
      setForm(emptyReviewForm);
      setProof(null);
      setProofType(null);
      setDeclared([]);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'left', 'right']} tabScreen>
      {header}

      <Notice>
        Your name is never published. Reviews show only the year of your tenancy, and your evidence is seen by the
        FindMyHome team alone.
      </Notice>

      <PropertyPicker value={property} onChange={setProperty} />

      <ReviewForm value={form} onChange={setForm} />

      <Card style={{ gap: space.md }}>
        <View style={{ gap: 2 }}>
          <Overline>Section 07</Overline>
          <T weight="semibold" size={16}>
            Evidence of tenancy
          </T>
          <T size={12} color={colors.muted}>
            Required. Accepted formats: PDF or image, up to 10 MB. The document must show your name and the property
            address.
          </T>
        </View>
        <RadioGroup
          options={(Object.keys(PROOF_LABELS) as ProofType[]).map((k) => ({ value: k, label: PROOF_LABELS[k] }))}
          value={proofType}
          onChange={setProofType}
        />
        <Button
          title={proof ? proof.name : 'Attach document'}
          variant="secondary"
          icon={proof ? 'document-attach-outline' : 'cloud-upload-outline'}
          onPress={pickProof}
        />
      </Card>

      <CheckGroup
        options={[
          {
            value: 'confirm' as const,
            label: 'I confirm that this review describes my own tenancy and that the information provided is accurate.',
          },
        ]}
        value={declared}
        onChange={setDeclared}
      />

      <ErrorText message={error} />
      <Button title="Submit for verification" onPress={submit} loading={busy} />
    </Screen>
  );
}

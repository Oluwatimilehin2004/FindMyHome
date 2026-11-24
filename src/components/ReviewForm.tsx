import { Switch, View } from 'react-native';

import {
  DEPOSIT_LABELS,
  LANDLORD_STATEMENTS,
  LISTING_ACCURACY_DESCRIPTIONS,
  LISTING_ACCURACY_LABELS,
  LISTING_ISSUE_LABELS,
  NOISE_LABELS,
  RECOMMENDATION_OPTIONS,
  SAFETY_LABELS,
  SECTION_HINTS,
  SECTION_TITLES,
  UTILITIES_LABELS,
  type LandlordKey,
} from '@/lib/labels';
import type {
  DepositOutcome,
  ListingAccuracy,
  ListingIssue,
  Noise,
  Recommendation,
  ReturnTime,
  ReviewDraft,
  Safety,
  Utilities,
  YesNoNa,
} from '@/lib/types';
import { colors, space } from '@/theme';

import { AnswerRow, Card, CheckGroup, Divider, Field, Overline, RadioGroup, T } from './ui';

export interface ReviewFormState {
  listing_accuracy: ListingAccuracy | null;
  listing_issues: ListingIssue[];
  listing_notes: string;
  deposit_outcome: DepositOutcome | null;
  deposit_reason_given: 'yes' | 'no' | null;
  deposit_return_time: ReturnTime | null;
  deposit_notes: string;
  landlord_agreement: YesNoNa | null;
  landlord_repairs: YesNoNa | null;
  landlord_notice: YesNoNa | null;
  landlord_respect: YesNoNa | null;
  landlord_notes: string;
  area_safety: Safety | null;
  area_noise: Noise | null;
  area_utilities: Utilities | null;
  area_notes: string;
  recommendation: Recommendation | null;
  overall_comment: string;
  moved_in: string; // YYYY-MM
  moved_out: string; // YYYY-MM
  still_living: boolean;
}

export const emptyReviewForm: ReviewFormState = {
  listing_accuracy: null,
  listing_issues: [],
  listing_notes: '',
  deposit_outcome: null,
  deposit_reason_given: null,
  deposit_return_time: null,
  deposit_notes: '',
  landlord_agreement: null,
  landlord_repairs: null,
  landlord_notice: null,
  landlord_respect: null,
  landlord_notes: '',
  area_safety: null,
  area_noise: null,
  area_utilities: null,
  area_notes: '',
  recommendation: null,
  overall_comment: '',
  moved_in: '',
  moved_out: '',
  still_living: false,
};

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

function toDate(month: string): string | null {
  const m = month.trim();
  return MONTH.test(m) ? `${m}-01` : null;
}

const needsReason = (d: DepositOutcome | null) => d === 'partial' || d === 'none';
const needsReturnTime = (d: DepositOutcome | null) => d === 'full' || d === 'partial';

/** Validate and convert. Returns a message for the reviewer, or the completed draft. */
export function toDraft(s: ReviewFormState): { error: string } | { draft: ReviewDraft } {
  if (!s.listing_accuracy) return { error: 'Section 1: state whether the property matched its advertisement.' };
  if (s.listing_accuracy !== 'as_advertised' && s.listing_issues.length === 0)
    return { error: 'Section 1: select at least one aspect that differed from the listing.' };
  if (!s.deposit_outcome) return { error: 'Section 2: state what happened to the security deposit.' };
  if (needsReason(s.deposit_outcome) && !s.deposit_reason_given)
    return { error: 'Section 2: state whether a written reason was given for the deduction.' };
  if (needsReturnTime(s.deposit_outcome) && !s.deposit_return_time)
    return { error: 'Section 2: state how long the deposit took to be returned.' };
  if (!s.landlord_agreement || !s.landlord_repairs || !s.landlord_notice || !s.landlord_respect)
    return { error: 'Section 3: answer all four landlord conduct statements.' };
  if (!s.area_safety || !s.area_noise || !s.area_utilities)
    return { error: 'Section 4: answer all three neighbourhood questions.' };
  if (s.moved_in && !toDate(s.moved_in)) return { error: 'Section 5: the move-in month should be written as YYYY-MM, e.g. 2025-09.' };
  if (!s.still_living && s.moved_out && !toDate(s.moved_out))
    return { error: 'Section 5: the move-out month should be written as YYYY-MM, e.g. 2026-06.' };
  const start = toDate(s.moved_in);
  const end = s.still_living ? null : toDate(s.moved_out);
  if (start && end && end < start) return { error: 'Section 5: the move-out month is earlier than the move-in month.' };
  if (!s.recommendation) return { error: 'Section 6: state whether you would recommend this property.' };

  return {
    draft: {
      answers: {
        listing_accuracy: s.listing_accuracy,
        listing_issues: s.listing_accuracy === 'as_advertised' ? [] : s.listing_issues,
        listing_notes: s.listing_notes.trim(),
        deposit_outcome: s.deposit_outcome,
        deposit_reason_given: needsReason(s.deposit_outcome) ? s.deposit_reason_given === 'yes' : null,
        deposit_return_time: needsReturnTime(s.deposit_outcome) ? s.deposit_return_time : null,
        deposit_notes: s.deposit_notes.trim(),
        landlord_agreement: s.landlord_agreement,
        landlord_repairs: s.landlord_repairs,
        landlord_notice: s.landlord_notice,
        landlord_respect: s.landlord_respect,
        landlord_notes: s.landlord_notes.trim(),
        area_safety: s.area_safety,
        area_noise: s.area_noise,
        area_utilities: s.area_utilities,
        area_notes: s.area_notes.trim(),
        recommendation: s.recommendation,
        overall_comment: s.overall_comment.trim(),
      },
      tenancy_start: start,
      tenancy_end: end,
    },
  };
}

const opts = <V extends string>(labels: Record<V, string>) =>
  (Object.keys(labels) as V[]).map((value) => ({ value, label: labels[value] }));

const YES_NO_NA = [
  { value: 'yes' as const, label: 'Yes' },
  { value: 'no' as const, label: 'No' },
  { value: 'na' as const, label: 'N/A' },
];

function Section({
  index,
  title,
  hint,
  children,
}: {
  index: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Card style={{ gap: space.md }}>
      <View style={{ gap: 2 }}>
        <Overline>Section {String(index).padStart(2, '0')}</Overline>
        <T weight="semibold" size={16}>
          {title}
        </T>
        {hint ? (
          <T size={12} color={colors.muted}>
            {hint}
          </T>
        ) : null}
      </View>
      {children}
    </Card>
  );
}

function Question({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <T size={13} weight="medium">
        {label}
      </T>
      {children}
    </View>
  );
}

/** The structured tenancy assessment used by students (Submit) and the team (early reviews). */
export function ReviewForm({ value, onChange }: { value: ReviewFormState; onChange: (next: ReviewFormState) => void }) {
  const set = <K extends keyof ReviewFormState>(k: K, v: ReviewFormState[K]) => onChange({ ...value, [k]: v });

  return (
    <View style={{ gap: space.lg }}>
      <Section index={1} title={SECTION_TITLES.listing} hint={SECTION_HINTS.listing}>
        <RadioGroup
          options={(Object.keys(LISTING_ACCURACY_LABELS) as ListingAccuracy[]).map((k) => ({
            value: k,
            label: LISTING_ACCURACY_LABELS[k],
            description: LISTING_ACCURACY_DESCRIPTIONS[k],
          }))}
          value={value.listing_accuracy}
          onChange={(v) => set('listing_accuracy', v)}
        />
        {value.listing_accuracy && value.listing_accuracy !== 'as_advertised' ? (
          <Question label="Which aspects differed? Select all that apply.">
            <CheckGroup
              options={opts(LISTING_ISSUE_LABELS)}
              value={value.listing_issues}
              onChange={(v) => set('listing_issues', v)}
            />
          </Question>
        ) : null}
        <Field
          label="Details"
          optional
          multiline
          value={value.listing_notes}
          onChangeText={(t) => set('listing_notes', t)}
          placeholder="Describe any differences factually, e.g. the refrigerator shown at the viewing was removed before move-in."
        />
      </Section>

      <Section index={2} title={SECTION_TITLES.deposit} hint={SECTION_HINTS.deposit}>
        <RadioGroup
          options={opts(DEPOSIT_LABELS)}
          value={value.deposit_outcome}
          onChange={(v) => set('deposit_outcome', v)}
        />
        {needsReason(value.deposit_outcome) ? (
          <AnswerRow
            question="Was a written reason given for the deduction?"
            options={[
              { value: 'yes' as const, label: 'Yes' },
              { value: 'no' as const, label: 'No' },
            ]}
            value={value.deposit_reason_given}
            onChange={(v) => set('deposit_reason_given', v)}
          />
        ) : null}
        {needsReturnTime(value.deposit_outcome) ? (
          <AnswerRow
            question="How long did the return take after move-out?"
            options={[
              { value: 'under_2_weeks' as const, label: '< 2 weeks' },
              { value: '2_to_4_weeks' as const, label: '2–4 weeks' },
              { value: 'over_a_month' as const, label: '> 1 month' },
            ]}
            value={value.deposit_return_time}
            onChange={(v) => set('deposit_return_time', v)}
          />
        ) : null}
        <Field
          label="Details"
          optional
          multiline
          value={value.deposit_notes}
          onChangeText={(t) => set('deposit_notes', t)}
          placeholder="Amount withheld and the reason stated, if any."
        />
      </Section>

      <Section index={3} title={SECTION_TITLES.landlord} hint={SECTION_HINTS.landlord}>
        {(Object.keys(LANDLORD_STATEMENTS) as LandlordKey[]).map((k, i) => (
          <View key={k} style={{ gap: space.md }}>
            {i > 0 ? <Divider /> : null}
            <AnswerRow
              question={`The landlord ${LANDLORD_STATEMENTS[k].charAt(0).toLowerCase()}${LANDLORD_STATEMENTS[k].slice(1)}.`}
              options={YES_NO_NA}
              value={value[k]}
              onChange={(v) => set(k, v)}
            />
          </View>
        ))}
        <Field
          label="Details"
          optional
          multiline
          value={value.landlord_notes}
          onChangeText={(t) => set('landlord_notes', t)}
          placeholder="Specific events are more useful than general opinions."
        />
      </Section>

      <Section index={4} title={SECTION_TITLES.area} hint={SECTION_HINTS.area}>
        <AnswerRow
          question="Personal safety in and around the compound"
          options={opts(SAFETY_LABELS)}
          value={value.area_safety}
          onChange={(v) => set('area_safety', v)}
        />
        <Divider />
        <AnswerRow
          question="Noise level"
          options={opts(NOISE_LABELS)}
          value={value.area_noise}
          onChange={(v) => set('area_noise', v)}
        />
        <Divider />
        <AnswerRow
          question="Reliability of water and electricity"
          options={[
            { value: 'reliable' as const, label: UTILITIES_LABELS.reliable },
            { value: 'occasional' as const, label: 'Occasional' },
            { value: 'frequent' as const, label: 'Frequent' },
          ]}
          value={value.area_utilities}
          onChange={(v) => set('area_utilities', v)}
        />
        <Field
          label="Details"
          optional
          multiline
          value={value.area_notes}
          onChangeText={(t) => set('area_notes', t)}
          placeholder="Distance to campus, transport, lighting at night, etc."
        />
      </Section>

      <Section index={5} title="Tenancy period" hint="Only the year is published, to protect your identity.">
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Field
              label="Moved in"
              value={value.moved_in}
              onChangeText={(t) => set('moved_in', t)}
              placeholder="YYYY-MM"
              keyboardType="numbers-and-punctuation"
              maxLength={7}
            />
          </View>
          <View style={{ flex: 1 }}>
            {!value.still_living ? (
              <Field
                label="Moved out"
                value={value.moved_out}
                onChangeText={(t) => set('moved_out', t)}
                placeholder="YYYY-MM"
                keyboardType="numbers-and-punctuation"
                maxLength={7}
              />
            ) : (
              <View style={{ gap: 6 }}>
                <T weight="medium" size={13}>
                  Moved out
                </T>
                <T size={14} color={colors.muted} style={{ paddingVertical: 12 }}>
                  Current tenant
                </T>
              </View>
            )}
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T size={14}>I currently live at this property</T>
          <Switch
            value={value.still_living}
            onValueChange={(v) => set('still_living', v)}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.raised}
          />
        </View>
      </Section>

      <Section index={6} title={SECTION_TITLES.recommendation} hint={SECTION_HINTS.recommendation}>
        <RadioGroup
          options={opts(RECOMMENDATION_OPTIONS)}
          value={value.recommendation}
          onChange={(v) => set('recommendation', v)}
        />
        <Field
          label="Additional information for future tenants"
          optional
          multiline
          value={value.overall_comment}
          onChangeText={(t) => set('overall_comment', t)}
        />
      </Section>
    </View>
  );
}

import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';

import {
  DEPOSIT_LABELS,
  DEPOSIT_TONE,
  LANDLORD_STATEMENTS,
  LISTING_ACCURACY_LABELS,
  LISTING_ACCURACY_TONE,
  LISTING_ISSUE_LABELS,
  NOISE_LABELS,
  NOISE_TONE,
  RECOMMENDATION_LABELS,
  RECOMMENDATION_TONE,
  RETURN_TIME_LABELS,
  SAFETY_LABELS,
  SAFETY_TONE,
  SECTION_TITLES,
  UTILITIES_LABELS,
  UTILITIES_TONE,
  YES_NO_NA_LABELS,
  type AnswerTone,
  type LandlordKey,
} from '@/lib/labels';
import type { ReviewRecord, YesNoNa } from '@/lib/types';
import { colors, radius, space } from '@/theme';

import { Badge, Card, Divider, Overline, T } from './ui';

const TONE_COLOR: Record<AnswerTone, string> = {
  ok: colors.ok,
  warn: colors.warn,
  danger: colors.danger,
  neutral: colors.muted,
};

/** A single answer: label on the left, toned value on the right. */
function AnswerLine({ label, value, tone }: { label: string; value: string; tone: AnswerTone }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md, paddingVertical: 4 }}>
      <T size={13} color={colors.muted} style={{ width: '42%' }}>
        {label}
      </T>
      <T size={13} weight="medium" color={TONE_COLOR[tone]} style={{ flex: 1, textAlign: 'right' }}>
        {value}
      </T>
    </View>
  );
}

function YesNoLine({ label, value }: { label: string; value: YesNoNa }) {
  const tone: AnswerTone = value === 'yes' ? 'ok' : value === 'no' ? 'danger' : 'neutral';
  const icon = value === 'yes' ? 'checkmark' : value === 'no' ? 'close' : 'remove';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: 4 }}>
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          marginTop: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: value === 'yes' ? colors.okSoft : value === 'no' ? colors.dangerSoft : colors.field,
        }}
      >
        <Ionicons name={icon} size={11} color={TONE_COLOR[tone]} />
      </View>
      <T size={13} style={{ flex: 1 }}>
        {label}
      </T>
      <T size={12} color={TONE_COLOR[tone]} weight="medium">
        {YES_NO_NA_LABELS[value]}
      </T>
    </View>
  );
}

function Notes({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return (
    <T size={13} color={colors.text} style={{ lineHeight: 20, marginTop: 2 }}>
      {text}
    </T>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.xs }}>
      <Overline>{title}</Overline>
      {children}
    </View>
  );
}

/**
 * Reusable display of a structured review (FR 3.2, SRS §5.4 reusability).
 * Used on the property page, in My reviews and in the verification screen.
 * Answers missing from older reviews are skipped rather than shown as blanks.
 */
export function ReviewRecordView({ review }: { review: ReviewRecord }) {
  const landlord = (Object.keys(LANDLORD_STATEMENTS) as LandlordKey[]).filter((k) => review[k]);
  const issues = (review.listing_issues ?? []).map((i) => LISTING_ISSUE_LABELS[i]);
  const hasArea = review.area_safety || review.area_noise || review.area_utilities || review.neighborhood_notes;

  return (
    <View style={{ gap: space.md }}>
      <Block title={SECTION_TITLES.listing}>
        {review.listing_accuracy ? (
          <AnswerLine
            label="Compared with the listing"
            value={LISTING_ACCURACY_LABELS[review.listing_accuracy]}
            tone={LISTING_ACCURACY_TONE[review.listing_accuracy]}
          />
        ) : null}
        {issues.length ? <AnswerLine label="Aspects that differed" value={issues.join(', ')} tone="neutral" /> : null}
        <Notes text={review.matched_promise_notes} />
      </Block>

      <Divider />

      <Block title={SECTION_TITLES.deposit}>
        <AnswerLine
          label="Outcome"
          value={DEPOSIT_LABELS[review.deposit_outcome]}
          tone={DEPOSIT_TONE[review.deposit_outcome]}
        />
        {review.deposit_reason_given != null ? (
          <AnswerLine
            label="Written reason for deduction"
            value={review.deposit_reason_given ? 'Provided' : 'Not provided'}
            tone={review.deposit_reason_given ? 'neutral' : 'danger'}
          />
        ) : null}
        {review.deposit_return_time ? (
          <AnswerLine
            label="Time taken to return"
            value={RETURN_TIME_LABELS[review.deposit_return_time]}
            tone={review.deposit_return_time === 'over_a_month' ? 'warn' : 'neutral'}
          />
        ) : null}
        <Notes text={review.deposit_notes} />
      </Block>

      {landlord.length || review.landlord_notes ? (
        <>
          <Divider />
          <Block title={SECTION_TITLES.landlord}>
            {landlord.map((k) => (
              <YesNoLine key={k} label={LANDLORD_STATEMENTS[k]} value={review[k]!} />
            ))}
            <Notes text={review.landlord_notes} />
          </Block>
        </>
      ) : null}

      {hasArea ? (
        <>
          <Divider />
          <Block title={SECTION_TITLES.area}>
            {review.area_safety ? (
              <AnswerLine label="Safety" value={SAFETY_LABELS[review.area_safety]} tone={SAFETY_TONE[review.area_safety]} />
            ) : null}
            {review.area_noise ? (
              <AnswerLine label="Noise" value={NOISE_LABELS[review.area_noise]} tone={NOISE_TONE[review.area_noise]} />
            ) : null}
            {review.area_utilities ? (
              <AnswerLine
                label="Water and electricity"
                value={UTILITIES_LABELS[review.area_utilities]}
                tone={UTILITIES_TONE[review.area_utilities]}
              />
            ) : null}
            <Notes text={review.neighborhood_notes} />
          </Block>
        </>
      ) : null}

      {review.overall_comment ? (
        <View style={{ backgroundColor: colors.field, borderRadius: radius.md, padding: space.md, gap: 4 }}>
          <Overline>Additional information</Overline>
          <T size={13} style={{ lineHeight: 20 }}>
            {review.overall_comment}
          </T>
        </View>
      ) : null}
    </View>
  );
}

/** Recommendation verdict as a status pill. */
export function RecommendationBadge({ value }: { value: ReviewRecord['recommendation'] }) {
  if (!value) return null;
  const tone = RECOMMENDATION_TONE[value];
  return <Badge label={RECOMMENDATION_LABELS[value]} tone={tone === 'neutral' ? 'neutral' : tone} />;
}

/** Public review card with a dark accent bar (reference: task cards). */
export function ReviewCard({ review, header }: { review: ReviewRecord; header?: React.ReactNode }) {
  return (
    <Card accent style={{ gap: space.md }}>
      {header}
      <ReviewRecordView review={review} />
    </Card>
  );
}

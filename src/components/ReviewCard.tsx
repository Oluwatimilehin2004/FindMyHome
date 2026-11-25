import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, UIManager, View } from 'react-native';

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

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

/** Section heading with its key answer, followed by the detail lines. */
function Section({
  title,
  summary,
  tone,
  children,
}: {
  title: string;
  summary: string;
  tone: AnswerTone;
  children: React.ReactNode;
}) {
  return (
    <View style={{ paddingVertical: space.sm, gap: 2 }}>
      <Overline>{title}</Overline>
      <T size={13} weight="medium" color={TONE_COLOR[tone]}>
        {summary}
      </T>
      <View style={{ gap: 2, marginTop: 2 }}>{children}</View>
    </View>
  );
}

/**
 * Reusable display of a structured review (FR 3.2, SRS §5.4 reusability).
 * Each section shows its key answer first, then the details.
 * Answers missing from older reviews are skipped rather than shown as blanks.
 */
export function ReviewRecordView({ review }: { review: ReviewRecord }) {
  const landlord = (Object.keys(LANDLORD_STATEMENTS) as LandlordKey[]).filter((k) => review[k]);
  const answered = landlord.filter((k) => review[k] !== 'na');
  const positive = answered.filter((k) => review[k] === 'yes').length;
  const issues = (review.listing_issues ?? []).map((i) => LISTING_ISSUE_LABELS[i]);
  const hasArea = review.area_safety || review.area_noise || review.area_utilities || review.neighborhood_notes;

  const landlordTone: AnswerTone =
    !answered.length ? 'neutral' : positive === answered.length ? 'ok' : positive === 0 ? 'danger' : 'warn';
  const areaTone: AnswerTone = review.area_safety ? SAFETY_TONE[review.area_safety] : 'neutral';

  return (
    <View>
      <Section
        title={SECTION_TITLES.listing}
        summary={review.listing_accuracy ? LISTING_ACCURACY_LABELS[review.listing_accuracy] : 'Details'}
        tone={review.listing_accuracy ? LISTING_ACCURACY_TONE[review.listing_accuracy] : 'neutral'}
      >
        {issues.length ? <AnswerLine label="Aspects that differed" value={issues.join(', ')} tone="neutral" /> : null}
        <Notes text={review.matched_promise_notes} />

      </Section>

      <Divider />

      <Section
        title={SECTION_TITLES.deposit}
        summary={DEPOSIT_LABELS[review.deposit_outcome]}
        tone={DEPOSIT_TONE[review.deposit_outcome]}
      >
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

      </Section>

      {landlord.length || review.landlord_notes ? (
        <>
          <Divider />
          <Section
            title={SECTION_TITLES.landlord}
            summary={answered.length ? `${positive} of ${answered.length} statements positive` : 'Details'}
            tone={landlordTone}
              >
            {landlord.map((k) => (
              <YesNoLine key={k} label={LANDLORD_STATEMENTS[k]} value={review[k]!} />
            ))}
            <Notes text={review.landlord_notes} />
          </Section>
        </>
      ) : null}

      {hasArea ? (
        <>
          <Divider />
          <Section
            title={SECTION_TITLES.area}
            summary={review.area_safety ? SAFETY_LABELS[review.area_safety] : 'Details'}
            tone={areaTone}
              >
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
          </Section>
        </>
      ) : null}

      {review.overall_comment ? (
        <>
          <Divider />
          <Section title="Additional information" summary="Note from the reviewer" tone="neutral">
            <View style={{ backgroundColor: colors.field, borderRadius: radius.md, padding: space.md }}>
              <T size={13} style={{ lineHeight: 20 }}>
                {review.overall_comment}
              </T>
            </View>
          </Section>
        </>
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

/** One-line overview used when a review card is collapsed. */
function summaryLine(review: ReviewRecord): string {
  const parts: string[] = [];
  if (review.listing_accuracy) parts.push(LISTING_ACCURACY_LABELS[review.listing_accuracy]);
  parts.push(`Deposit: ${DEPOSIT_LABELS[review.deposit_outcome].toLowerCase()}`);
  if (review.area_safety) parts.push(SAFETY_LABELS[review.area_safety]);
  return parts.join(' · ');
}

/**
 * Public review card with a dark accent bar (reference: task cards).
 * Collapsed by default: the header and a one-line overview; the full review opens on demand.
 */
export function ReviewCard({
  review,
  header,
  defaultOpen,
}: {
  review: ReviewRecord;
  header?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };
  return (
    <Card accent style={{ gap: space.sm }}>
      {header}
      {open ? (
        <ReviewRecordView review={review} />
      ) : (
        <T size={13} color={colors.muted} numberOfLines={2}>
          {summaryLine(review)}
        </T>
      )}
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={6}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 })}
      >
        <T size={13} weight="medium">
          {open ? 'Show less' : 'Read full review'}
        </T>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.text} />
      </Pressable>
    </Card>
  );
}
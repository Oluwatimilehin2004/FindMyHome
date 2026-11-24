import type {
  DepositOutcome,
  ListingAccuracy,
  ListingIssue,
  Noise,
  ProofType,
  Recommendation,
  ReturnTime,
  ReviewStatus,
  Safety,
  Utilities,
  YesNoNa,
} from './types';

export type AnswerTone = 'ok' | 'warn' | 'danger' | 'neutral';

// ------------------------------------------------------------------ Sections

export const SECTION_TITLES = {
  listing: 'Accuracy of the listing',
  deposit: 'Security deposit',
  landlord: 'Landlord conduct',
  area: 'Neighbourhood and compound',
  recommendation: 'Recommendation',
} as const;

export const SECTION_HINTS = {
  listing: 'Compare the property at move-in with the photographs, description and viewing.',
  deposit: 'How the deposit (caution fee) was handled at the end of the tenancy.',
  landlord: 'Answer each statement based on your own experience as a tenant.',
  area: 'The immediate surroundings of the property and the compound.',
  recommendation: 'Your overall assessment for a student considering this property.',
} as const;

// ------------------------------------------------------------------ Listing accuracy

export const LISTING_ACCURACY_LABELS: Record<ListingAccuracy, string> = {
  as_advertised: 'As advertised',
  minor_differences: 'Minor differences',
  significant_differences: 'Significant differences',
  not_as_advertised: 'Not as advertised',
};

export const LISTING_ACCURACY_DESCRIPTIONS: Record<ListingAccuracy, string> = {
  as_advertised: 'The property matched what was shown and described.',
  minor_differences: 'Small discrepancies that did not affect daily living.',
  significant_differences: 'Differences that affected comfort, cost or safety.',
  not_as_advertised: 'The property was materially different from the listing.',
};

export const LISTING_ACCURACY_TONE: Record<ListingAccuracy, AnswerTone> = {
  as_advertised: 'ok',
  minor_differences: 'neutral',
  significant_differences: 'warn',
  not_as_advertised: 'danger',
};

export const LISTING_ISSUE_LABELS: Record<ListingIssue, string> = {
  condition: 'Condition and finishing',
  furnishing: 'Furniture and appliances',
  water: 'Water supply',
  electricity: 'Electricity',
  security: 'Security (gate, locks, guard)',
  size_layout: 'Size or layout',
  charges: 'Rent or additional charges',
};

// ------------------------------------------------------------------ Deposit

export const DEPOSIT_LABELS: Record<DepositOutcome, string> = {
  full: 'Returned in full',
  partial: 'Partly returned',
  none: 'Not returned',
  not_yet: 'Not yet due (current tenant)',
};

export const DEPOSIT_TONE: Record<DepositOutcome, AnswerTone> = {
  full: 'ok',
  partial: 'warn',
  none: 'danger',
  not_yet: 'neutral',
};

export const RETURN_TIME_LABELS: Record<ReturnTime, string> = {
  under_2_weeks: 'Within 2 weeks',
  '2_to_4_weeks': '2 to 4 weeks',
  over_a_month: 'More than a month',
};

// ------------------------------------------------------------------ Landlord

export const YES_NO_NA_LABELS: Record<YesNoNa, string> = {
  yes: 'Yes',
  no: 'No',
  na: 'Not applicable',
};

export const LANDLORD_STATEMENTS = {
  landlord_agreement: 'Honoured the terms of the written agreement',
  landlord_repairs: 'Handled repair requests within a reasonable time',
  landlord_notice: 'Gave proper notice before visits or changes',
  landlord_respect: 'Communicated respectfully and professionally',
} as const;

export type LandlordKey = keyof typeof LANDLORD_STATEMENTS;

// ------------------------------------------------------------------ Neighbourhood

export const SAFETY_LABELS: Record<Safety, string> = {
  safe: 'Felt safe',
  some_concerns: 'Some concerns',
  unsafe: 'Felt unsafe',
};
export const SAFETY_TONE: Record<Safety, AnswerTone> = { safe: 'ok', some_concerns: 'warn', unsafe: 'danger' };

export const NOISE_LABELS: Record<Noise, string> = {
  quiet: 'Quiet',
  moderate: 'Moderate',
  disruptive: 'Disruptive',
};
export const NOISE_TONE: Record<Noise, AnswerTone> = { quiet: 'ok', moderate: 'neutral', disruptive: 'danger' };

export const UTILITIES_LABELS: Record<Utilities, string> = {
  reliable: 'Reliable',
  occasional: 'Occasional outages',
  frequent: 'Frequent outages',
};
export const UTILITIES_TONE: Record<Utilities, AnswerTone> = { reliable: 'ok', occasional: 'warn', frequent: 'danger' };

// ------------------------------------------------------------------ Recommendation

export const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  recommend: 'Recommended',
  reservations: 'Recommended with reservations',
  not_recommend: 'Not recommended',
};

export const RECOMMENDATION_OPTIONS: Record<Recommendation, string> = {
  recommend: 'I would recommend this property',
  reservations: 'I would recommend it, with reservations',
  not_recommend: 'I would not recommend this property',
};

export const RECOMMENDATION_TONE: Record<Recommendation, AnswerTone> = {
  recommend: 'ok',
  reservations: 'warn',
  not_recommend: 'danger',
};

// ------------------------------------------------------------------ Records

export const PROOF_LABELS: Record<ProofType, string> = {
  lease: 'Signed tenancy agreement',
  landlord_confirmation: 'Written landlord confirmation',
  payment_receipt: 'Rent payment receipt',
  other: 'Other official document',
};

export const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: 'Under verification',
  approved: 'Published',
  rejected: 'Not approved',
};

export const SOURCE_LABELS = {
  student: 'Verified tenant',
  admin_manual: 'Verified by FindMyHome',
} as const;

// ------------------------------------------------------------------ Formatting

/** "KG 9 Ave, Kagugu" — adds the neighbourhood only when the address does not already mention it. */
export function formatLocation(address: string | null | undefined, neighborhood: string | null | undefined): string {
  const a = (address ?? '').trim();
  const n = (neighborhood ?? '').trim();
  if (!a) return n || 'Kigali';
  if (!n || a.toLowerCase().includes(n.toLowerCase())) return a;
  return `${a}, ${n}`;
}

export function formatRwf(n: number | null | undefined, short = false): string {
  if (n == null) return '—';
  const amount = `RWF ${Number(n).toLocaleString('en-US')}`;
  return short ? `${amount}/mo` : `${amount} per month`;
}

/** Formal reference number, e.g. FMH-2026-0012. */
export function formatRef(refNo: number | null | undefined, createdAt: string): string {
  const year = new Date(createdAt).getFullYear();
  return `FMH-${year}-${String(refNo ?? 0).padStart(4, '0')}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 23 Nov 2026 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Nov 2026 (for YYYY-MM-DD tenancy dates) */
export function formatMonth(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m] = iso.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

/** "4 of 5" style tally, or a dash when nobody answered. */
export function tally(yes: number, total: number): string {
  return Number(total) > 0 ? `${Number(yes)} of ${Number(total)}` : '—';
}

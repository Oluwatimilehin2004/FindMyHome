export type Role = 'student' | 'admin';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type ReviewSource = 'student' | 'admin_manual';
export type ProofType = 'lease' | 'landlord_confirmation' | 'payment_receipt' | 'other';

// Structured review answers (replace the old 1–5 star ratings).
export type ListingAccuracy = 'as_advertised' | 'minor_differences' | 'significant_differences' | 'not_as_advertised';
export type ListingIssue = 'condition' | 'furnishing' | 'water' | 'electricity' | 'security' | 'size_layout' | 'charges';
export type DepositOutcome = 'full' | 'partial' | 'none' | 'not_yet';
export type ReturnTime = 'under_2_weeks' | '2_to_4_weeks' | 'over_a_month';
export type YesNoNa = 'yes' | 'no' | 'na';
export type Safety = 'safe' | 'some_concerns' | 'unsafe';
export type Noise = 'quiet' | 'moderate' | 'disruptive';
export type Utilities = 'reliable' | 'occasional' | 'frequent';
export type Recommendation = 'recommend' | 'reservations' | 'not_recommend';

export interface Profile {
  id: string;
  full_name: string;
  university: string;
  is_international: boolean;
  role: Role;
}

/** Row returned by search_properties. */
export interface PropertySummary {
  id: string;
  name: string;
  address: string;
  neighborhood: string | null;
  landlord_name: string | null;
  monthly_rent_rwf: number | null;
  furnished: boolean | null;
  photo_url: string | null;
  review_count: number;
  recommend_pct: number | null;
  accurate_pct: number | null;
  deposit_fair_pct: number | null;
  created_at: string;
}

/** Row returned by get_property: the summary plus a tally of every structured answer. */
export interface PropertyDetail extends PropertySummary {
  recommend_yes: number;
  recommend_reservations: number;
  recommend_answered: number;
  accuracy_as_advertised: number;
  accuracy_minor: number;
  accuracy_answered: number;
  deposit_full: number;
  deposit_decided: number;
  agreement_yes: number;
  agreement_answered: number;
  repairs_yes: number;
  repairs_answered: number;
  notice_yes: number;
  notice_answered: number;
  respect_yes: number;
  respect_answered: number;
  safety_safe: number;
  safety_answered: number;
  noise_quiet: number;
  noise_answered: number;
  utilities_reliable: number;
  utilities_answered: number;
}

/**
 * Answers as stored on a review. Reviews written before the structured form
 * may have some answers missing, so everything except the deposit is nullable.
 */
export interface ReviewRecord {
  listing_accuracy: ListingAccuracy | null;
  listing_issues: ListingIssue[] | null;
  matched_promise_notes: string;
  deposit_outcome: DepositOutcome;
  deposit_reason_given: boolean | null;
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
  neighborhood_notes: string;
  recommendation: Recommendation | null;
  overall_comment: string;
}

/** Anonymous, approved review as returned by get_property_reviews. */
export interface PublicReview extends ReviewRecord {
  id: string;
  source: ReviewSource;
  lived_there_year: number | null;
  is_current_tenant: boolean;
  approved_at: string | null;
}

/** Full review row — visible only to its author and admins (RLS). */
export interface ReviewRow extends ReviewRecord {
  id: string;
  ref_no: number;
  property_id: string;
  author_id: string | null;
  source: ReviewSource;
  status: ReviewStatus;
  tenancy_start: string | null;
  tenancy_end: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
}

/** Completed answers as sent to submit_review / admin_add_review (keys match p_answers). */
export interface ReviewAnswers {
  listing_accuracy: ListingAccuracy;
  listing_issues: ListingIssue[];
  listing_notes: string;
  deposit_outcome: DepositOutcome;
  deposit_reason_given: boolean | null;
  deposit_return_time: ReturnTime | null;
  deposit_notes: string;
  landlord_agreement: YesNoNa;
  landlord_repairs: YesNoNa;
  landlord_notice: YesNoNa;
  landlord_respect: YesNoNa;
  landlord_notes: string;
  area_safety: Safety;
  area_noise: Noise;
  area_utilities: Utilities;
  area_notes: string;
  recommendation: Recommendation;
  overall_comment: string;
}

export interface ReviewDraft {
  answers: ReviewAnswers;
  tenancy_start: string | null;
  tenancy_end: string | null;
}

export interface Neighborhood {
  id: string;
  name: string;
}

export interface Landlord {
  id: string;
  name: string;
}

export type NotificationKind = 'review_approved' | 'review_rejected';

/** In-app notification (e.g. a review decision), visible only to its recipient. */
export interface AppNotification {
  id: string;
  review_id: string | null;
  kind: NotificationKind;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

/** Released only to signed-in users, one property at a time. */
export interface LandlordContact {
  landlord_name: string;
  phone: string;
  whatsapp: boolean;
}

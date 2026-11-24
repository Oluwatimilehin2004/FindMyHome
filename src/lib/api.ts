/**
 * Every call the app makes to the backend lives here, so screens stay simple and
 * the backend can be swapped later without touching UI code (SRS §5.4 adaptability).
 */
import { PHOTO_BUCKET, PROOF_BUCKET, supabase } from './supabase';
import type {
  Landlord,
  Neighborhood,
  ProofType,
  PropertyDetail,
  PropertySummary,
  PublicReview,
  ReviewDraft,
  ReviewRow,
  AppNotification,
  LandlordContact,
} from './types';

/** Turn backend / network failures into plain-English messages (NFR 5). */
export function friendlyError(err: unknown): string {
  const msg =
    typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : String(err);
  if (/network request failed|failed to fetch|fetch failed|network/i.test(msg)) {
    return 'A connection could not be established. Please check your internet connection and try again.';
  }
  if (/invalid login credentials/i.test(msg)) return 'The email address and password do not match our records.';
  if (/email not confirmed/i.test(msg))
    return 'This account has not been activated yet. Please contact the FindMyHome team.';
  if (/user already registered/i.test(msg)) return 'An account with this email address already exists. Please sign in instead.';
  if (/password should be at least/i.test(msg)) return 'Your password must be at least 8 characters long.';
  if (/permission denied for function get_landlord_contact/i.test(msg))
    return 'Please sign in to view the landlord’s contact details.';
  if (/jwt|not authenticated|permission denied/i.test(msg)) return 'Your session has expired. Please sign in again.';
  // Messages raised by our own database functions are already written for students.
  return msg || 'An unexpected error occurred. Please try again.';
}

function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data as T;
}

// ---------------------------------------------------------------- Public reads

export async function searchProperties(q: string): Promise<PropertySummary[]> {
  return unwrap(await supabase.rpc('search_properties', { q })) ?? [];
}

export async function getProperty(id: string): Promise<PropertyDetail | null> {
  const rows: PropertyDetail[] = unwrap(await supabase.rpc('get_property', { p_id: id })) ?? [];
  return rows[0] ?? null;
}

export async function getPropertyReviews(id: string): Promise<PublicReview[]> {
  return unwrap(await supabase.rpc('get_property_reviews', { p_id: id })) ?? [];
}

/** Whether the landlord's phone number is on file for this property (the number itself is not returned). */
export async function landlordContactAvailable(propertyId: string): Promise<boolean> {
  return Boolean(unwrap(await supabase.rpc('landlord_contact_available', { p_property_id: propertyId })));
}

/** Signed-in users only. Each request is logged for the team. */
export async function getLandlordContact(propertyId: string): Promise<LandlordContact | null> {
  const rows: LandlordContact[] = unwrap(await supabase.rpc('get_landlord_contact', { p_property_id: propertyId })) ?? [];
  return rows[0] ?? null;
}

// ---------------------------------------------------------------- Student

export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
}

export async function uploadProof(userId: string, file: PickedFile): Promise<string> {
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'bin';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const body = await (await fetch(file.uri)).arrayBuffer();
  const { error } = await supabase.storage.from(PROOF_BUCKET).upload(path, body, {
    contentType: file.mimeType,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export interface SubmitReviewInput extends ReviewDraft {
  propertyId: string | null;
  newPropertyName?: string;
  newPropertyAddress?: string;
  proofType: ProofType;
  proofPath: string;
}

export async function submitReview(input: SubmitReviewInput): Promise<string> {
  return unwrap(
    await supabase.rpc('submit_review', {
      p_property_id: input.propertyId,
      p_new_property_name: input.newPropertyName ?? null,
      p_new_property_address: input.newPropertyAddress ?? null,
      p_answers: input.answers,
      p_tenancy_start: input.tenancy_start,
      p_tenancy_end: input.tenancy_end,
      p_proof_type: input.proofType,
      p_proof_path: input.proofPath,
    }),
  );
}

/** Reference details for a review the current user just submitted (own rows are readable under RLS). */
export async function getReviewReference(id: string): Promise<{ ref_no: number; created_at: string } | null> {
  return unwrap(
    await supabase.from('reviews').select('ref_no, created_at').eq('id', id).maybeSingle(),
  ) as { ref_no: number; created_at: string } | null;
}

export type MyReview = ReviewRow & { property: { name: string; address: string; photo_url: string | null } | null };

export async function getMyReviews(userId: string): Promise<MyReview[]> {
  return unwrap(
    await supabase
      .from('reviews')
      .select('*, property:properties(name, address, photo_url)')
      .eq('author_id', userId)
      .order('created_at', { ascending: false }),
  ) as MyReview[];
}

// ---------------------------------------------------------------- Notifications

export async function getNotifications(): Promise<AppNotification[]> {
  return (unwrap(
    await supabase
      .from('notifications')
      .select('id, review_id, kind, title, body, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ) ?? []) as AppNotification[];
}

/** Mark the given notifications as read, or all of them when no ids are passed. */
export async function markNotificationsRead(ids?: string[]): Promise<void> {
  unwrap(await supabase.rpc('mark_notifications_read', { p_ids: ids ?? null }));
}

// ---------------------------------------------------------------- Admin

export type QueueReview = ReviewRow & {
  property: { name: string; address: string } | null;
  author: { full_name: string; university: string } | null;
  reviewer: { full_name: string } | null;
  proofs: { id: string; proof_type: ProofType; storage_path: string; file_removed_at: string | null }[];
};

const QUEUE_SELECT =
  '*, property:properties(name, address), author:profiles!reviews_author_id_fkey(full_name, university), reviewer:profiles!reviews_reviewed_by_fkey(full_name), proofs:residency_proofs(id, proof_type, storage_path, file_removed_at)';

export async function getPendingReviews(): Promise<QueueReview[]> {
  return unwrap(
    await supabase.from('reviews').select(QUEUE_SELECT).eq('status', 'pending').order('created_at'),
  ) as QueueReview[];
}

/** Approved and declined reviews, most recent decision first (audit trail). */
export async function getDecisionHistory(): Promise<QueueReview[]> {
  return unwrap(
    await supabase
      .from('reviews')
      .select(QUEUE_SELECT)
      .in('status', ['approved', 'rejected'])
      .order('reviewed_at', { ascending: false, nullsFirst: false })
      .limit(100),
  ) as QueueReview[];
}

export async function getReviewForAdmin(id: string): Promise<QueueReview | null> {
  return unwrap(await supabase.from('reviews').select(QUEUE_SELECT).eq('id', id).maybeSingle()) as QueueReview | null;
}

/** Short-lived link so the admin can open a proof document (bucket is private, NFR 2). */
export async function getProofUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(PROOF_BUCKET).createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}

export async function moderateReview(id: string, approve: boolean, reason?: string): Promise<void> {
  unwrap(await supabase.rpc('moderate_review', { p_review_id: id, p_approve: approve, p_reason: reason ?? null }));
}

/** Delete evidence files from storage and record the removal. Returns how many files were removed. */
export async function removeEvidenceFiles(paths: string[]): Promise<number> {
  if (!paths.length) return 0;
  const { data, error } = await supabase.storage.from(PROOF_BUCKET).remove(paths);
  if (error) throw error;
  // Storage returns only the files it actually deleted; record exactly those.
  const removed = (data ?? []).map((o) => o.name);
  if (removed.length) unwrap(await supabase.rpc('admin_mark_proofs_removed', { p_paths: removed }));
  return removed.length;
}

/** Evidence files that should no longer be kept (declined reviews, or no review at all). */
export async function getStaleEvidenceFiles(): Promise<{ path: string; reason: string }[]> {
  return unwrap(await supabase.rpc('admin_stale_proof_files')) ?? [];
}

export async function adminAddReview(propertyId: string, draft: ReviewDraft, collectionNote: string): Promise<string> {
  return unwrap(
    await supabase.rpc('admin_add_review', {
      p_property_id: propertyId,
      p_answers: draft.answers,
      p_tenancy_start: draft.tenancy_start,
      p_tenancy_end: draft.tenancy_end,
      p_collection_note: collectionNote,
    }),
  );
}

export async function listNeighborhoods(): Promise<Neighborhood[]> {
  return unwrap(await supabase.from('neighborhoods').select('id, name').order('name')) ?? [];
}

export async function listLandlords(): Promise<Landlord[]> {
  return unwrap(await supabase.from('landlords').select('id, name').order('name')) ?? [];
}

export interface PropertyInput {
  name: string;
  address: string;
  neighborhoodName: string;
  landlordName: string;
  landlordPhone: string;
  landlordWhatsapp: boolean;
  monthlyRentRwf: number | null;
  furnished: boolean | null;
  isPublished: boolean;
}

export interface EditableProperty extends PropertyInput {
  id: string;
  photoUrl: string | null;
}

async function resolveNeighborhood(name: string): Promise<string | null> {
  if (!name.trim()) return null;
  const n = unwrap(
    await supabase.from('neighborhoods').upsert({ name: name.trim() }, { onConflict: 'name' }).select('id').single(),
  ) as { id: string };
  return n.id;
}

/** Finds the landlord by name (case-insensitive) or creates them, then stores or clears their private phone number. */
async function resolveLandlord(name: string, phone: string, whatsapp: boolean): Promise<string | null> {
  if (!name.trim()) return null;
  const existing = unwrap(
    await supabase.from('landlords').select('id').ilike('name', name.trim()).limit(1),
  ) as { id: string }[];
  const id =
    existing[0]?.id ??
    (unwrap(await supabase.from('landlords').insert({ name: name.trim() }).select('id').single()) as { id: string }).id;

  const cleaned = phone.replace(/[^0-9+ ]/g, '').trim();
  if (cleaned) {
    unwrap(
      await supabase
        .from('landlord_contacts')
        .upsert({ landlord_id: id, phone: cleaned, whatsapp, updated_at: new Date().toISOString() }),
    );
  } else {
    unwrap(await supabase.from('landlord_contacts').delete().eq('landlord_id', id));
  }
  return id;
}

/** Admin "Add property" (use-case diagram). Creates neighbourhood/landlord rows on the fly if new. */
export async function adminCreateProperty(input: PropertyInput): Promise<string> {
  const neighborhoodId = await resolveNeighborhood(input.neighborhoodName);
  const landlordId = await resolveLandlord(input.landlordName, input.landlordPhone, input.landlordWhatsapp);
  const row = unwrap(
    await supabase
      .from('properties')
      .insert({
        name: input.name.trim(),
        address: input.address.trim(),
        neighborhood_id: neighborhoodId,
        landlord_id: landlordId,
        monthly_rent_rwf: input.monthlyRentRwf,
        furnished: input.furnished,
        is_published: input.isPublished,
      })
      .select('id')
      .single(),
  ) as { id: string };
  return row.id;
}

/** Admin "Edit property": loads the listing with its landlord's private contact. */
export async function adminGetProperty(id: string): Promise<EditableProperty | null> {
  const row = unwrap(
    await supabase
      .from('properties')
      .select(
        'id, name, address, monthly_rent_rwf, furnished, is_published, photo_url, landlord_id, neighborhood:neighborhoods(name), landlord:landlords(name)',
      )
      .eq('id', id)
      .maybeSingle(),
  ) as {
    id: string;
    name: string;
    address: string | null;
    monthly_rent_rwf: number | null;
    furnished: boolean | null;
    is_published: boolean;
    photo_url: string | null;
    landlord_id: string | null;
    neighborhood: { name: string } | null;
    landlord: { name: string } | null;
  } | null;
  if (!row) return null;

  let contact: { phone: string; whatsapp: boolean } | null = null;
  if (row.landlord_id) {
    contact = unwrap(
      await supabase.from('landlord_contacts').select('phone, whatsapp').eq('landlord_id', row.landlord_id).maybeSingle(),
    ) as { phone: string; whatsapp: boolean } | null;
  }

  return {
    id: row.id,
    name: row.name,
    address: row.address ?? '',
    neighborhoodName: row.neighborhood?.name ?? '',
    landlordName: row.landlord?.name ?? '',
    landlordPhone: contact?.phone ?? '',
    landlordWhatsapp: contact?.whatsapp ?? true,
    monthlyRentRwf: row.monthly_rent_rwf,
    furnished: row.furnished,
    isPublished: row.is_published,
    photoUrl: row.photo_url,
  };
}

export async function adminUpdateProperty(id: string, input: PropertyInput): Promise<void> {
  const neighborhoodId = await resolveNeighborhood(input.neighborhoodName);
  const landlordId = await resolveLandlord(input.landlordName, input.landlordPhone, input.landlordWhatsapp);
  unwrap(
    await supabase
      .from('properties')
      .update({
        name: input.name.trim(),
        address: input.address.trim(),
        neighborhood_id: neighborhoodId,
        landlord_id: landlordId,
        monthly_rent_rwf: input.monthlyRentRwf,
        furnished: input.furnished,
        is_published: input.isPublished,
      })
      .eq('id', id),
  );
}

/** Admin: set a property's cover photo (public bucket, admins only can write). */
export async function adminSetPropertyPhoto(propertyId: string, file: PickedFile): Promise<string> {
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'jpg';
  const path = `${propertyId}/${Date.now()}.${ext}`;
  const body = await (await fetch(file.uri)).arrayBuffer();
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, body, {
    contentType: file.mimeType,
    upsert: false,
  });
  if (error) throw error;
  const url = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
  unwrap(await supabase.from('properties').update({ photo_url: url }).eq('id', propertyId));
  return url;
}

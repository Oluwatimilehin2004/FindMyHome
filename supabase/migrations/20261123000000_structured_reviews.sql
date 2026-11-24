-- FindMyHome (FMH) — structured reviews
--
-- Replaces 1–5 star ratings with structured, factual answers that a student can
-- act on (listing accuracy, deposit handling, landlord conduct, neighbourhood,
-- recommendation). Adds a formal reference number to every review.
--
-- Existing data is kept: the old star columns stay (now optional) and existing
-- reviews get a listing-accuracy answer derived from their old score. Answers that
-- cannot be derived honestly are left empty and are simply not shown.

-- ---------------------------------------------------------------------------
-- New columns
-- ---------------------------------------------------------------------------
alter table public.reviews
  add column if not exists ref_no              bigint generated always as identity,
  add column if not exists listing_accuracy    text
    check (listing_accuracy in ('as_advertised', 'minor_differences', 'significant_differences', 'not_as_advertised')),
  add column if not exists listing_issues      text[] not null default '{}'
    check (listing_issues <@ array['condition', 'furnishing', 'water', 'electricity', 'security', 'size_layout', 'charges']::text[]),
  add column if not exists deposit_reason_given boolean,
  add column if not exists deposit_return_time text
    check (deposit_return_time in ('under_2_weeks', '2_to_4_weeks', 'over_a_month')),
  add column if not exists landlord_agreement  text check (landlord_agreement in ('yes', 'no', 'na')),
  add column if not exists landlord_repairs    text check (landlord_repairs   in ('yes', 'no', 'na')),
  add column if not exists landlord_notice     text check (landlord_notice    in ('yes', 'no', 'na')),
  add column if not exists landlord_respect    text check (landlord_respect   in ('yes', 'no', 'na')),
  add column if not exists area_safety         text check (area_safety    in ('safe', 'some_concerns', 'unsafe')),
  add column if not exists area_noise          text check (area_noise     in ('quiet', 'moderate', 'disruptive')),
  add column if not exists area_utilities      text check (area_utilities in ('reliable', 'occasional', 'frequent')),
  add column if not exists recommendation      text check (recommendation in ('recommend', 'reservations', 'not_recommend'));

create unique index if not exists reviews_ref_no on public.reviews (ref_no);

-- The star columns are no longer collected.
alter table public.reviews
  alter column matched_promise     drop not null,
  alter column landlord_rating     drop not null,
  alter column neighborhood_rating drop not null;

-- Carry over the one answer that maps directly from the old data.
update public.reviews
   set listing_accuracy = case
         when matched_promise >= 5 then 'as_advertised'
         when matched_promise >= 3 then 'minor_differences'
         when matched_promise = 2  then 'significant_differences'
         else 'not_as_advertised'
       end
 where listing_accuracy is null and matched_promise is not null;

-- ---------------------------------------------------------------------------
-- Shared validation for a set of answers (used by student and admin entry)
-- ---------------------------------------------------------------------------
create or replace function public.validate_review_answers(a jsonb)
returns void
language plpgsql
immutable
set search_path = public
as $$
begin
  if coalesce(a ->> 'listing_accuracy', '') = '' then
    raise exception 'Please state whether the property matched its advertisement.' using errcode = '22023';
  end if;
  if coalesce(a ->> 'deposit_outcome', '') = '' then
    raise exception 'Please state what happened to the security deposit.' using errcode = '22023';
  end if;
  if coalesce(a ->> 'landlord_agreement', '') = '' or coalesce(a ->> 'landlord_repairs', '') = ''
     or coalesce(a ->> 'landlord_notice', '') = '' or coalesce(a ->> 'landlord_respect', '') = '' then
    raise exception 'Please answer all four landlord conduct questions.' using errcode = '22023';
  end if;
  if coalesce(a ->> 'area_safety', '') = '' or coalesce(a ->> 'area_noise', '') = ''
     or coalesce(a ->> 'area_utilities', '') = '' then
    raise exception 'Please answer all three neighbourhood questions.' using errcode = '22023';
  end if;
  if coalesce(a ->> 'recommendation', '') = '' then
    raise exception 'Please state whether you would recommend this property.' using errcode = '22023';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Student write API (replaces the star-based version)
-- ---------------------------------------------------------------------------
drop function if exists public.submit_review(uuid, text, text, smallint, text, text, text, smallint, text, smallint, text, text, date, date, text, text);

create or replace function public.submit_review(
  p_property_id          uuid,
  p_new_property_name    text,
  p_new_property_address text,
  p_answers              jsonb,
  p_tenancy_start        date,
  p_tenancy_end          date,
  p_proof_type           text,
  p_proof_path           text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_property_id uuid := p_property_id;
  v_review_id   uuid;
begin
  if v_uid is null then
    raise exception 'Please sign in to submit a review.' using errcode = '28000';
  end if;

  if p_proof_path is null or split_part(p_proof_path, '/', 1) <> v_uid::text then
    raise exception 'Please attach evidence of your tenancy.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from storage.objects
    where bucket_id = 'tenancy-proofs' and name = p_proof_path and owner_id = v_uid::text
  ) then
    raise exception 'Your evidence upload could not be found. Please attach it again.' using errcode = '22023';
  end if;

  perform public.validate_review_answers(p_answers);

  if v_property_id is null then
    if coalesce(trim(p_new_property_name), '') = '' then
      raise exception 'Please select a property or enter its name.' using errcode = '22023';
    end if;
    insert into public.properties (name, address, is_published, created_by)
    values (trim(p_new_property_name), coalesce(trim(p_new_property_address), ''), false, v_uid)
    returning id into v_property_id;
  elsif not exists (select 1 from public.properties where id = v_property_id) then
    raise exception 'The selected property could not be found.' using errcode = '22023';
  end if;

  insert into public.reviews (
    property_id, author_id, source, status,
    listing_accuracy, listing_issues, matched_promise_notes,
    deposit_outcome, deposit_reason_given, deposit_return_time, deposit_notes,
    landlord_agreement, landlord_repairs, landlord_notice, landlord_respect, landlord_notes,
    area_safety, area_noise, area_utilities, neighborhood_notes,
    recommendation, overall_comment,
    tenancy_start, tenancy_end
  ) values (
    v_property_id, v_uid, 'student', 'pending',
    p_answers ->> 'listing_accuracy',
    coalesce(array(select jsonb_array_elements_text(coalesce(p_answers -> 'listing_issues', '[]'::jsonb))), '{}'),
    coalesce(p_answers ->> 'listing_notes', ''),
    p_answers ->> 'deposit_outcome',
    (p_answers ->> 'deposit_reason_given')::boolean,
    nullif(p_answers ->> 'deposit_return_time', ''),
    coalesce(p_answers ->> 'deposit_notes', ''),
    p_answers ->> 'landlord_agreement', p_answers ->> 'landlord_repairs',
    p_answers ->> 'landlord_notice', p_answers ->> 'landlord_respect',
    coalesce(p_answers ->> 'landlord_notes', ''),
    p_answers ->> 'area_safety', p_answers ->> 'area_noise', p_answers ->> 'area_utilities',
    coalesce(p_answers ->> 'area_notes', ''),
    p_answers ->> 'recommendation',
    coalesce(p_answers ->> 'overall_comment', ''),
    p_tenancy_start, p_tenancy_end
  )
  returning id into v_review_id;

  insert into public.residency_proofs (review_id, proof_type, storage_path)
  values (v_review_id, p_proof_type, p_proof_path);

  insert into public.review_events (review_id, event, actor_id)
  values (v_review_id, 'submitted', v_uid);

  return v_review_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin manual entry (FR 5.2), structured version
-- ---------------------------------------------------------------------------
drop function if exists public.admin_add_review(uuid, smallint, text, text, text, smallint, text, smallint, text, text, date, date, text);

create or replace function public.admin_add_review(
  p_property_id     uuid,
  p_answers         jsonb,
  p_tenancy_start   date,
  p_tenancy_end     date,
  p_collection_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only the FindMyHome team can add reviews manually.' using errcode = '42501';
  end if;
  if coalesce(trim(p_collection_note), '') = '' then
    raise exception 'Please record how and when this review was collected.' using errcode = '22023';
  end if;

  perform public.validate_review_answers(p_answers);

  insert into public.reviews (
    property_id, author_id, source, entered_by, status,
    listing_accuracy, listing_issues, matched_promise_notes,
    deposit_outcome, deposit_reason_given, deposit_return_time, deposit_notes,
    landlord_agreement, landlord_repairs, landlord_notice, landlord_respect, landlord_notes,
    area_safety, area_noise, area_utilities, neighborhood_notes,
    recommendation, overall_comment,
    tenancy_start, tenancy_end,
    reviewed_by, reviewed_at
  ) values (
    p_property_id, null, 'admin_manual', auth.uid(), 'approved',
    p_answers ->> 'listing_accuracy',
    coalesce(array(select jsonb_array_elements_text(coalesce(p_answers -> 'listing_issues', '[]'::jsonb))), '{}'),
    coalesce(p_answers ->> 'listing_notes', ''),
    p_answers ->> 'deposit_outcome',
    (p_answers ->> 'deposit_reason_given')::boolean,
    nullif(p_answers ->> 'deposit_return_time', ''),
    coalesce(p_answers ->> 'deposit_notes', ''),
    p_answers ->> 'landlord_agreement', p_answers ->> 'landlord_repairs',
    p_answers ->> 'landlord_notice', p_answers ->> 'landlord_respect',
    coalesce(p_answers ->> 'landlord_notes', ''),
    p_answers ->> 'area_safety', p_answers ->> 'area_noise', p_answers ->> 'area_utilities',
    coalesce(p_answers ->> 'area_notes', ''),
    p_answers ->> 'recommendation',
    coalesce(p_answers ->> 'overall_comment', ''),
    p_tenancy_start, p_tenancy_end,
    auth.uid(), now()
  )
  returning id into v_review_id;

  update public.properties set is_published = true where id = p_property_id;

  insert into public.review_events (review_id, event, actor_id, note)
  values (v_review_id, 'manually_added', auth.uid(), trim(p_collection_note));

  return v_review_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public read API: summaries built from the structured answers
-- ---------------------------------------------------------------------------
drop function if exists public.search_properties(text);
drop function if exists public.get_property(uuid);
drop function if exists public.get_property_reviews(uuid);

create or replace function public.search_properties(q text default '')
returns table (
  id                uuid,
  name              text,
  address           text,
  neighborhood      text,
  landlord_name     text,
  monthly_rent_rwf  integer,
  furnished         boolean,
  photo_url         text,
  review_count      bigint,
  recommend_pct     numeric,
  accurate_pct      numeric,
  deposit_fair_pct  numeric,
  created_at        timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with term as (select '%' || trim(coalesce(q, '')) || '%' as t, trim(coalesce(q, '')) = '' as empty)
  select
    p.id, p.name, p.address, n.name, l.name, p.monthly_rent_rwf, p.furnished, p.photo_url,
    count(r.id),
    round(100.0 * count(r.id) filter (where r.recommendation = 'recommend')
          / nullif(count(r.recommendation), 0)),
    round(100.0 * count(r.id) filter (where r.listing_accuracy = 'as_advertised')
          / nullif(count(r.listing_accuracy), 0)),
    round(100.0 * count(r.id) filter (where r.deposit_outcome = 'full')
          / nullif(count(r.id) filter (where r.deposit_outcome <> 'not_yet'), 0)),
    p.created_at
  from public.properties p
  cross join term
  left join public.neighborhoods n on n.id = p.neighborhood_id
  left join public.landlords l on l.id = p.landlord_id
  left join public.reviews r on r.property_id = p.id and r.status = 'approved'
  where p.is_published
    and (term.empty or p.name ilike term.t or p.address ilike term.t or n.name ilike term.t)
  group by p.id, n.name, l.name
  order by count(r.id) desc, p.name
  limit 50;
$$;

-- One property with a full tally of every answer, so the app can say
-- "4 of 5 verified tenants…" instead of showing an average.
create or replace function public.get_property(p_id uuid)
returns table (
  id                       uuid,
  name                     text,
  address                  text,
  neighborhood             text,
  landlord_name            text,
  monthly_rent_rwf         integer,
  furnished                boolean,
  photo_url                text,
  review_count             bigint,
  recommend_pct            numeric,
  accurate_pct             numeric,
  deposit_fair_pct         numeric,
  created_at               timestamptz,
  recommend_yes            bigint,
  recommend_reservations   bigint,
  recommend_answered       bigint,
  accuracy_as_advertised   bigint,
  accuracy_minor           bigint,
  accuracy_answered        bigint,
  deposit_full             bigint,
  deposit_decided          bigint,
  agreement_yes            bigint,
  agreement_answered       bigint,
  repairs_yes              bigint,
  repairs_answered         bigint,
  notice_yes               bigint,
  notice_answered          bigint,
  respect_yes              bigint,
  respect_answered         bigint,
  safety_safe              bigint,
  safety_answered          bigint,
  noise_quiet              bigint,
  noise_answered           bigint,
  utilities_reliable       bigint,
  utilities_answered       bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.name, p.address, n.name, l.name, p.monthly_rent_rwf, p.furnished, p.photo_url,
    count(r.id),
    round(100.0 * count(r.id) filter (where r.recommendation = 'recommend') / nullif(count(r.recommendation), 0)),
    round(100.0 * count(r.id) filter (where r.listing_accuracy = 'as_advertised') / nullif(count(r.listing_accuracy), 0)),
    round(100.0 * count(r.id) filter (where r.deposit_outcome = 'full')
          / nullif(count(r.id) filter (where r.deposit_outcome <> 'not_yet'), 0)),
    p.created_at,
    count(r.id) filter (where r.recommendation = 'recommend'),
    count(r.id) filter (where r.recommendation = 'reservations'),
    count(r.recommendation),
    count(r.id) filter (where r.listing_accuracy = 'as_advertised'),
    count(r.id) filter (where r.listing_accuracy = 'minor_differences'),
    count(r.listing_accuracy),
    count(r.id) filter (where r.deposit_outcome = 'full'),
    count(r.id) filter (where r.deposit_outcome <> 'not_yet'),
    count(r.id) filter (where r.landlord_agreement = 'yes'),
    count(r.id) filter (where r.landlord_agreement in ('yes', 'no')),
    count(r.id) filter (where r.landlord_repairs = 'yes'),
    count(r.id) filter (where r.landlord_repairs in ('yes', 'no')),
    count(r.id) filter (where r.landlord_notice = 'yes'),
    count(r.id) filter (where r.landlord_notice in ('yes', 'no')),
    count(r.id) filter (where r.landlord_respect = 'yes'),
    count(r.id) filter (where r.landlord_respect in ('yes', 'no')),
    count(r.id) filter (where r.area_safety = 'safe'),
    count(r.area_safety),
    count(r.id) filter (where r.area_noise = 'quiet'),
    count(r.area_noise),
    count(r.id) filter (where r.area_utilities = 'reliable'),
    count(r.area_utilities)
  from public.properties p
  left join public.neighborhoods n on n.id = p.neighborhood_id
  left join public.landlords l on l.id = p.landlord_id
  left join public.reviews r on r.property_id = p.id and r.status = 'approved'
  where p.id = p_id and p.is_published
  group by p.id, n.name, l.name;
$$;

-- Approved reviews for one property. Still omits author identity, exact dates
-- and proof data (§5.2: protect reviewers from retaliation).
create or replace function public.get_property_reviews(p_id uuid)
returns table (
  id                    uuid,
  source                text,
  listing_accuracy      text,
  listing_issues        text[],
  matched_promise_notes text,
  deposit_outcome       text,
  deposit_reason_given  boolean,
  deposit_return_time   text,
  deposit_notes         text,
  landlord_agreement    text,
  landlord_repairs      text,
  landlord_notice       text,
  landlord_respect      text,
  landlord_notes        text,
  area_safety           text,
  area_noise            text,
  area_utilities        text,
  neighborhood_notes    text,
  recommendation        text,
  overall_comment       text,
  lived_there_year      integer,
  is_current_tenant     boolean,
  approved_at           timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id, r.source,
    r.listing_accuracy, r.listing_issues, r.matched_promise_notes,
    r.deposit_outcome, r.deposit_reason_given, r.deposit_return_time, r.deposit_notes,
    r.landlord_agreement, r.landlord_repairs, r.landlord_notice, r.landlord_respect, r.landlord_notes,
    r.area_safety, r.area_noise, r.area_utilities, r.neighborhood_notes,
    r.recommendation, r.overall_comment,
    extract(year from coalesce(r.tenancy_end, r.tenancy_start))::int,
    (r.tenancy_end is null and r.tenancy_start is not null),
    r.reviewed_at
  from public.reviews r
  join public.properties p on p.id = r.property_id and p.is_published
  where r.property_id = p_id and r.status = 'approved'
  order by r.reviewed_at desc nulls last;
$$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
revoke execute on function public.validate_review_answers(jsonb) from public, anon, authenticated;
revoke execute on function public.search_properties(text) from public;
revoke execute on function public.get_property(uuid) from public;
revoke execute on function public.get_property_reviews(uuid) from public;
revoke execute on function public.submit_review(uuid, text, text, jsonb, date, date, text, text) from public, anon;
revoke execute on function public.admin_add_review(uuid, jsonb, date, date, text) from public, anon;

grant execute on function public.search_properties(text)    to anon, authenticated;
grant execute on function public.get_property(uuid)         to anon, authenticated;
grant execute on function public.get_property_reviews(uuid) to anon, authenticated;
grant execute on function public.submit_review(uuid, text, text, jsonb, date, date, text, text) to authenticated;
grant execute on function public.admin_add_review(uuid, jsonb, date, date, text) to authenticated;

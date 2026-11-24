-- FindMyHome (FMH) — initial schema
-- Maps to SRS v1.0: FR 1–5, NFR 2, NFR 6, NFR 9, §5.2 (reviewer anonymity), §5.5 (business rules)
--
-- Trust model, enforced in the database rather than the app:
--   * Students never read the `reviews` table of other people. Public reads go
--     through SECURITY DEFINER functions that return APPROVED reviews only and
--     never return author identity (§5.2, §5.5).
--   * Students cannot insert reviews directly. They call `submit_review`, which
--     requires an uploaded proof-of-tenancy file and always creates the review
--     as PENDING (FR 4.2, §5.5, NFR 9).
--   * Proof files live in a private storage bucket readable by admins only (NFR 2).
--   * Every submission / manual entry / decision is written to `review_events` (NFR 6).

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Profiles (User → Student / Admin in the class diagram)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  full_name        text not null default '',
  university       text not null default 'African Leadership University',
  is_international boolean not null default false,
  role             text not null default 'student' check (role in ('student', 'admin')),
  created_at       timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Create a profile row whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, is_international)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'is_international')::boolean, false)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Neighbourhoods, landlords, properties
-- ---------------------------------------------------------------------------
create table public.neighborhoods (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  district   text,
  created_at timestamptz not null default now()
);

-- No phone number in this release: SRS §5.2 rules out contact-sharing.
create table public.landlords (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table public.properties (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  address          text not null default '',
  neighborhood_id  uuid references public.neighborhoods (id) on delete set null,
  landlord_id      uuid references public.landlords (id) on delete set null,
  monthly_rent_rwf integer check (monthly_rent_rwf is null or monthly_rent_rwf >= 0),
  furnished        boolean,
  -- Properties suggested by students stay hidden from search until the team
  -- approves a review for them.
  is_published     boolean not null default true,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now()
);

create index properties_name_trgm on public.properties using gin (name extensions.gin_trgm_ops);
create index properties_address_trgm on public.properties using gin (address extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Reviews (the four categories from SRS §2.2 / FR 3.2)
-- ---------------------------------------------------------------------------
create table public.reviews (
  id                     uuid primary key default gen_random_uuid(),
  property_id            uuid not null references public.properties (id) on delete cascade,
  -- null for reviews the team collected manually from tenants (FR 5.2)
  author_id              uuid references public.profiles (id) on delete set null,
  source                 text not null check (source in ('student', 'admin_manual')),
  entered_by             uuid references public.profiles (id) on delete set null,
  status                 text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),

  -- 1. Did the property match what was promised? (photos, condition, amenities)
  matched_promise        smallint not null check (matched_promise between 1 and 5),
  matched_promise_notes  text not null default '',
  -- 2. Was the deposit / caution fee returned fairly?
  deposit_outcome        text not null check (deposit_outcome in ('full', 'partial', 'none', 'not_yet')),
  deposit_notes          text not null default '',
  -- 3. Landlord conduct (fairness, responsiveness, honesty)
  landlord_rating        smallint not null check (landlord_rating between 1 and 5),
  landlord_notes         text not null default '',
  -- 4. Neighbourhood / compound (safety, noise, community)
  neighborhood_rating    smallint not null check (neighborhood_rating between 1 and 5),
  neighborhood_notes     text not null default '',

  overall_comment        text not null default '',
  tenancy_start          date,
  tenancy_end            date,  -- null = still living there

  rejection_reason       text,
  reviewed_by            uuid references public.profiles (id) on delete set null,
  reviewed_at            timestamptz,
  created_at             timestamptz not null default now(),

  constraint tenancy_order check (tenancy_end is null or tenancy_start is null or tenancy_end >= tenancy_start),
  constraint student_reviews_have_author check (source <> 'student' or author_id is not null)
);

create index reviews_property_status on public.reviews (property_id, status);
create index reviews_author on public.reviews (author_id);
create index reviews_pending on public.reviews (created_at) where status = 'pending';

-- ResidencyProof is composed into Review: deleting the review deletes the proof row.
create table public.residency_proofs (
  id           uuid primary key default gen_random_uuid(),
  review_id    uuid not null references public.reviews (id) on delete cascade,
  proof_type   text not null check (proof_type in ('lease', 'landlord_confirmation', 'payment_receipt', 'other')),
  storage_path text not null,
  verified     boolean not null default false,
  created_at   timestamptz not null default now()
);

create index residency_proofs_review on public.residency_proofs (review_id);

-- NFR 6: audit trail of where each review came from and who decided on it.
create table public.review_events (
  id         bigint generated always as identity primary key,
  review_id  uuid not null references public.reviews (id) on delete cascade,
  event      text not null check (event in ('submitted', 'manually_added', 'approved', 'rejected')),
  actor_id   uuid references public.profiles (id) on delete set null,
  note       text,
  created_at timestamptz not null default now()
);

create index review_events_review on public.review_events (review_id);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.neighborhoods    enable row level security;
alter table public.landlords        enable row level security;
alter table public.properties       enable row level security;
alter table public.reviews          enable row level security;
alter table public.residency_proofs enable row level security;
alter table public.review_events    enable row level security;

-- Profiles: you see yourself; admins see everyone (needed for verification).
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
-- Students can edit their own details but never their role.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, university, is_international) on public.profiles to authenticated;

-- Reference data is public (guest browsing allowed, SRS §5.3); admins write.
create policy neighborhoods_read on public.neighborhoods for select using (true);
create policy neighborhoods_admin on public.neighborhoods for all
  using (public.is_admin()) with check (public.is_admin());

create policy landlords_read on public.landlords for select using (true);
create policy landlords_admin on public.landlords for all
  using (public.is_admin()) with check (public.is_admin());

create policy properties_read on public.properties
  for select using (is_published or created_by = auth.uid() or public.is_admin());
create policy properties_admin on public.properties for all
  using (public.is_admin()) with check (public.is_admin());

-- Reviews: only your own, or everything if admin. No direct insert for students.
create policy reviews_select on public.reviews
  for select using (author_id = auth.uid() or public.is_admin());
create policy reviews_admin_update on public.reviews
  for update using (public.is_admin()) with check (public.is_admin());
create policy reviews_admin_delete on public.reviews
  for delete using (public.is_admin());

-- Proofs and audit log: admins only (NFR 2, NFR 6).
create policy proofs_admin on public.residency_proofs for all
  using (public.is_admin()) with check (public.is_admin());
create policy events_admin_read on public.review_events
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Public read API (guests and students). Never returns reviewer identity.
-- ---------------------------------------------------------------------------
create or replace function public.search_properties(q text default '')
returns table (
  id                  uuid,
  name                text,
  address             text,
  neighborhood        text,
  landlord_name       text,
  monthly_rent_rwf    integer,
  furnished           boolean,
  review_count        bigint,
  avg_matched_promise numeric,
  avg_landlord        numeric,
  avg_neighborhood    numeric,
  deposit_fair_pct    numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with term as (select '%' || trim(coalesce(q, '')) || '%' as t, trim(coalesce(q, '')) = '' as empty)
  select
    p.id, p.name, p.address, n.name, l.name, p.monthly_rent_rwf, p.furnished,
    count(r.id),
    round(avg(r.matched_promise), 1),
    round(avg(r.landlord_rating), 1),
    round(avg(r.neighborhood_rating), 1),
    round(100.0 * count(r.id) filter (where r.deposit_outcome = 'full')
          / nullif(count(r.id) filter (where r.deposit_outcome <> 'not_yet'), 0))
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

create or replace function public.get_property(p_id uuid)
returns table (
  id                  uuid,
  name                text,
  address             text,
  neighborhood        text,
  landlord_name       text,
  monthly_rent_rwf    integer,
  furnished           boolean,
  review_count        bigint,
  avg_matched_promise numeric,
  avg_landlord        numeric,
  avg_neighborhood    numeric,
  deposit_fair_pct    numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.name, p.address, n.name, l.name, p.monthly_rent_rwf, p.furnished,
    count(r.id),
    round(avg(r.matched_promise), 1),
    round(avg(r.landlord_rating), 1),
    round(avg(r.neighborhood_rating), 1),
    round(100.0 * count(r.id) filter (where r.deposit_outcome = 'full')
          / nullif(count(r.id) filter (where r.deposit_outcome <> 'not_yet'), 0))
  from public.properties p
  left join public.neighborhoods n on n.id = p.neighborhood_id
  left join public.landlords l on l.id = p.landlord_id
  left join public.reviews r on r.property_id = p.id and r.status = 'approved'
  where p.id = p_id and p.is_published
  group by p.id, n.name, l.name;
$$;

-- Approved reviews for one property. Deliberately omits author_id, names,
-- exact tenancy dates and proof data (§5.2: protect reviewers from retaliation).
create or replace function public.get_property_reviews(p_id uuid)
returns table (
  id                    uuid,
  source                text,
  matched_promise       smallint,
  matched_promise_notes text,
  deposit_outcome       text,
  deposit_notes         text,
  landlord_rating       smallint,
  landlord_notes        text,
  neighborhood_rating   smallint,
  neighborhood_notes    text,
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
    r.matched_promise, r.matched_promise_notes,
    r.deposit_outcome, r.deposit_notes,
    r.landlord_rating, r.landlord_notes,
    r.neighborhood_rating, r.neighborhood_notes,
    r.overall_comment,
    extract(year from coalesce(r.tenancy_end, r.tenancy_start))::int,
    (r.tenancy_end is null and r.tenancy_start is not null),
    r.reviewed_at
  from public.reviews r
  join public.properties p on p.id = r.property_id and p.is_published
  where r.property_id = p_id and r.status = 'approved'
  order by r.reviewed_at desc nulls last;
$$;

-- ---------------------------------------------------------------------------
-- Student write API
-- ---------------------------------------------------------------------------
-- FR 4.1 + 4.2: submit a review together with its proof of tenancy.
-- The proof file must already be uploaded to tenancy-proofs/<auth.uid()>/...
-- Either p_property_id or p_new_property_name must be given.
create or replace function public.submit_review(
  p_property_id           uuid,
  p_new_property_name     text,
  p_new_property_address  text,
  p_matched_promise       smallint,
  p_matched_promise_notes text,
  p_deposit_outcome       text,
  p_deposit_notes         text,
  p_landlord_rating       smallint,
  p_landlord_notes        text,
  p_neighborhood_rating   smallint,
  p_neighborhood_notes    text,
  p_overall_comment       text,
  p_tenancy_start         date,
  p_tenancy_end           date,
  p_proof_type            text,
  p_proof_path            text
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
    raise exception 'Please log in to submit a review.' using errcode = '28000';
  end if;

  if p_proof_path is null or split_part(p_proof_path, '/', 1) <> v_uid::text then
    raise exception 'Please attach proof that you lived at this property.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from storage.objects
    where bucket_id = 'tenancy-proofs' and name = p_proof_path and owner_id = v_uid::text
  ) then
    raise exception 'We could not find your proof upload. Please attach it again.' using errcode = '22023';
  end if;

  if v_property_id is null then
    if coalesce(trim(p_new_property_name), '') = '' then
      raise exception 'Please choose a property or enter its name.' using errcode = '22023';
    end if;
    insert into public.properties (name, address, is_published, created_by)
    values (trim(p_new_property_name), coalesce(trim(p_new_property_address), ''), false, v_uid)
    returning id into v_property_id;
  elsif not exists (select 1 from public.properties where id = v_property_id) then
    raise exception 'We could not find that property.' using errcode = '22023';
  end if;

  insert into public.reviews (
    property_id, author_id, source, status,
    matched_promise, matched_promise_notes,
    deposit_outcome, deposit_notes,
    landlord_rating, landlord_notes,
    neighborhood_rating, neighborhood_notes,
    overall_comment, tenancy_start, tenancy_end
  ) values (
    v_property_id, v_uid, 'student', 'pending',
    p_matched_promise, coalesce(p_matched_promise_notes, ''),
    p_deposit_outcome, coalesce(p_deposit_notes, ''),
    p_landlord_rating, coalesce(p_landlord_notes, ''),
    p_neighborhood_rating, coalesce(p_neighborhood_notes, ''),
    coalesce(p_overall_comment, ''), p_tenancy_start, p_tenancy_end
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
-- Admin API
-- ---------------------------------------------------------------------------
-- FR 5.1: approve or reject a pending review.
create or replace function public.moderate_review(p_review_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.reviews;
begin
  if not public.is_admin() then
    raise exception 'Only the FindMyHome team can verify reviews.' using errcode = '42501';
  end if;

  select * into v_review from public.reviews where id = p_review_id for update;
  if not found then
    raise exception 'Review not found.' using errcode = '22023';
  end if;
  if v_review.status <> 'pending' then
    raise exception 'This review has already been %.', v_review.status using errcode = '22023';
  end if;

  if p_approve then
    -- §5.5: a student review cannot go live without proof.
    if v_review.source = 'student'
       and not exists (select 1 from public.residency_proofs where review_id = p_review_id) then
      raise exception 'This review has no proof of tenancy and cannot be approved.' using errcode = '22023';
    end if;
    update public.residency_proofs set verified = true where review_id = p_review_id;
    update public.reviews
       set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = null
     where id = p_review_id;
    update public.properties set is_published = true where id = v_review.property_id;
  else
    if coalesce(trim(p_reason), '') = '' then
      raise exception 'Please give the student a reason for rejecting.' using errcode = '22023';
    end if;
    update public.reviews
       set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = trim(p_reason)
     where id = p_review_id;
  end if;

  insert into public.review_events (review_id, event, actor_id, note)
  values (p_review_id, case when p_approve then 'approved' else 'rejected' end, auth.uid(), p_reason);
end;
$$;

-- FR 5.2: the team enters a review collected through manual outreach.
-- Published immediately, but clearly labelled as source = 'admin_manual' (NFR 6).
create or replace function public.admin_add_review(
  p_property_id           uuid,
  p_matched_promise       smallint,
  p_matched_promise_notes text,
  p_deposit_outcome       text,
  p_deposit_notes         text,
  p_landlord_rating       smallint,
  p_landlord_notes        text,
  p_neighborhood_rating   smallint,
  p_neighborhood_notes    text,
  p_overall_comment       text,
  p_tenancy_start         date,
  p_tenancy_end           date,
  p_collection_note       text
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

  insert into public.reviews (
    property_id, author_id, source, entered_by, status,
    matched_promise, matched_promise_notes,
    deposit_outcome, deposit_notes,
    landlord_rating, landlord_notes,
    neighborhood_rating, neighborhood_notes,
    overall_comment, tenancy_start, tenancy_end,
    reviewed_by, reviewed_at
  ) values (
    p_property_id, null, 'admin_manual', auth.uid(), 'approved',
    p_matched_promise, coalesce(p_matched_promise_notes, ''),
    p_deposit_outcome, coalesce(p_deposit_notes, ''),
    p_landlord_rating, coalesce(p_landlord_notes, ''),
    p_neighborhood_rating, coalesce(p_neighborhood_notes, ''),
    coalesce(p_overall_comment, ''), p_tenancy_start, p_tenancy_end,
    auth.uid(), now()
  )
  returning id into v_review_id;

  insert into public.review_events (review_id, event, actor_id, note)
  values (v_review_id, 'manually_added', auth.uid(), p_collection_note);

  return v_review_id;
end;
$$;

-- Lock down function execution.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.search_properties(text)      to anon, authenticated;
grant execute on function public.get_property(uuid)           to anon, authenticated;
grant execute on function public.get_property_reviews(uuid)   to anon, authenticated;
grant execute on function public.is_admin()                   to anon, authenticated;
grant execute on function public.submit_review(uuid, text, text, smallint, text, text, text, smallint, text, smallint, text, text, date, date, text, text) to authenticated;
grant execute on function public.moderate_review(uuid, boolean, text) to authenticated;
grant execute on function public.admin_add_review(uuid, smallint, text, text, text, smallint, text, smallint, text, text, date, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for proof-of-tenancy documents (NFR 2)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tenancy-proofs', 'tenancy-proofs', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do nothing;

-- Students may upload only into their own folder. They cannot read files back.
create policy proofs_student_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'tenancy-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy proofs_admin_read on storage.objects
  for select to authenticated
  using (bucket_id = 'tenancy-proofs' and public.is_admin());

create policy proofs_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'tenancy-proofs' and public.is_admin());


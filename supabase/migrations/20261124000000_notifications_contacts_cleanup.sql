-- FindMyHome (FMH) — notifications, self-approval guard, landlord contacts, evidence clean-up
--
-- 1. Students are notified when their review is approved or declined.
-- 2. Admins cannot verify their own submissions.
-- 3. Landlord phone numbers are stored privately and released only to signed-in users,
--    one property at a time, with every request logged.
-- 4. Evidence files of declined or deleted reviews can be found and removed.

-- ---------------------------------------------------------------------------
-- 1. Notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  review_id  uuid references public.reviews(id) on delete set null,
  kind       text not null check (kind in ('review_approved', 'review_rejected')),
  title      text not null,
  body       text not null,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_own_read on public.notifications;
create policy notifications_own_read on public.notifications
  for select using (user_id = auth.uid());

-- Users never write notifications directly; they are created by moderate_review()
-- and marked read through mark_notifications_read().
revoke insert, update, delete on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

-- Live updates in the app (Supabase Realtime). Skipped where the publication does not exist (local tests).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
     set read_at = now()
   where user_id = auth.uid()
     and read_at is null
     and (p_ids is null or id = any (p_ids));
$$;

-- ---------------------------------------------------------------------------
-- 2. Moderation: no self-approval, and notify the reviewer
-- ---------------------------------------------------------------------------
create or replace function public.moderate_review(p_review_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review   public.reviews;
  v_property text;
  v_ref      text;
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
  if v_review.author_id = auth.uid() then
    raise exception 'You cannot verify your own review. Another member of the FindMyHome team must verify it.'
      using errcode = '42501';
  end if;

  select name into v_property from public.properties where id = v_review.property_id;
  v_ref := 'FMH-' || extract(year from v_review.created_at)::int || '-' || lpad(v_review.ref_no::text, 4, '0');

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
      raise exception 'Please state the reason for declining.' using errcode = '22023';
    end if;
    update public.reviews
       set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = trim(p_reason)
     where id = p_review_id;
  end if;

  insert into public.review_events (review_id, event, actor_id, note)
  values (p_review_id, case when p_approve then 'approved' else 'rejected' end, auth.uid(), p_reason);

  if v_review.author_id is not null then
    insert into public.notifications (user_id, review_id, kind, title, body)
    values (
      v_review.author_id,
      p_review_id,
      case when p_approve then 'review_approved' else 'review_rejected' end,
      case when p_approve then 'Your review has been published' else 'Your review was not approved' end,
      case when p_approve
        then 'Your review of ' || coalesce(v_property, 'the property') || ' (Ref. ' || v_ref
             || ') has been verified and is now visible to other students.'
        else 'Your review of ' || coalesce(v_property, 'the property') || ' (Ref. ' || v_ref
             || ') could not be approved. Reason: ' || trim(p_reason)
      end
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Landlord contacts (private; released per property to signed-in users)
-- ---------------------------------------------------------------------------
create table if not exists public.landlord_contacts (
  landlord_id uuid primary key references public.landlords(id) on delete cascade,
  phone       text not null check (phone ~ '^\+?[0-9 ]{7,20}$'),
  whatsapp    boolean not null default true,
  updated_at  timestamptz not null default now()
);

alter table public.landlord_contacts enable row level security;

drop policy if exists landlord_contacts_admin on public.landlord_contacts;
create policy landlord_contacts_admin on public.landlord_contacts
  for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.contact_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists contact_requests_user_day on public.contact_requests (user_id, created_at desc);

alter table public.contact_requests enable row level security;

drop policy if exists contact_requests_admin_read on public.contact_requests;
create policy contact_requests_admin_read on public.contact_requests
  for select using (public.is_admin());

revoke insert, update, delete on public.contact_requests from anon, authenticated;

-- Whether a published property has a landlord phone on file (no number is revealed).
create or replace function public.landlord_contact_available(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.properties p
    join public.landlord_contacts c on c.landlord_id = p.landlord_id
    where p.id = p_property_id and p.is_published
  );
$$;

-- Releases the landlord's phone number for one property to a signed-in user and logs the request.
create or replace function public.get_landlord_contact(p_property_id uuid)
returns table (landlord_name text, phone text, whatsapp boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Please sign in to view the landlord''s contact details.' using errcode = '28000';
  end if;

  if (select count(*) from public.contact_requests
       where user_id = v_uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'You have reached the daily limit for contact requests. Please try again tomorrow.'
      using errcode = '54000';
  end if;

  if not exists (select 1 from public.properties where id = p_property_id and is_published) then
    raise exception 'This property could not be found.' using errcode = '22023';
  end if;

  insert into public.contact_requests (user_id, property_id) values (v_uid, p_property_id);

  return query
    select l.name, c.phone, c.whatsapp
    from public.properties p
    join public.landlords l on l.id = p.landlord_id
    join public.landlord_contacts c on c.landlord_id = l.id
    where p.id = p_property_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Evidence clean-up
-- ---------------------------------------------------------------------------
-- Files are removed through the Storage API by an admin (Supabase blocks direct SQL deletes
-- on storage.objects). The database records when a file was removed.
alter table public.residency_proofs add column if not exists file_removed_at timestamptz;

create or replace function public.admin_mark_proofs_removed(p_paths text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the FindMyHome team can manage evidence files.' using errcode = '42501';
  end if;
  update public.residency_proofs
     set file_removed_at = now()
   where storage_path = any (p_paths) and file_removed_at is null;
end;
$$;

-- Evidence files that should no longer be kept:
--   * files attached to declined reviews, and
--   * files with no review at all (review deleted, or upload abandoned more than a day ago).
create or replace function public.admin_stale_proof_files()
returns table (path text, reason text)
language plpgsql
stable
security definer
set search_path = public, storage
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the FindMyHome team can manage evidence files.' using errcode = '42501';
  end if;
  return query
    select o.name::text,
           case when rp.id is null then 'No matching review' else 'Review declined' end
    from storage.objects o
    left join public.residency_proofs rp on rp.storage_path = o.name
    left join public.reviews r on r.id = rp.review_id
    where o.bucket_id = 'tenancy-proofs'
      and (
        (rp.id is null and o.created_at < now() - interval '1 day')
        or r.status = 'rejected'
      );
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
revoke execute on function public.landlord_contact_available(uuid) from public;
revoke execute on function public.get_landlord_contact(uuid) from public, anon;
revoke execute on function public.admin_mark_proofs_removed(text[]) from public, anon;
revoke execute on function public.admin_stale_proof_files() from public, anon;

grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
grant execute on function public.landlord_contact_available(uuid) to anon, authenticated;
grant execute on function public.get_landlord_contact(uuid) to authenticated;
grant execute on function public.admin_mark_proofs_removed(text[]) to authenticated;
grant execute on function public.admin_stale_proof_files() to authenticated;

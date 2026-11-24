-- Property cover photos (for the photo-led UI). Added by the FMH team only.
-- Photos of a building are public information, so this bucket is public —
-- unlike tenancy-proofs, which stays private (NFR 2).

alter table public.properties add column if not exists photo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-photos', 'property-photos', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy property_photos_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'property-photos' and public.is_admin());
create policy property_photos_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'property-photos' and public.is_admin());
create policy property_photos_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'property-photos' and public.is_admin());

-- Return the photo (and an overall score) from the public read functions.
drop function if exists public.search_properties(text);
drop function if exists public.get_property(uuid);

create or replace function public.search_properties(q text default '')
returns table (
  id                  uuid,
  name                text,
  address             text,
  neighborhood        text,
  landlord_name       text,
  monthly_rent_rwf    integer,
  furnished           boolean,
  photo_url           text,
  review_count        bigint,
  avg_overall         numeric,
  avg_matched_promise numeric,
  avg_landlord        numeric,
  avg_neighborhood    numeric,
  deposit_fair_pct    numeric,
  created_at          timestamptz
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
    round(avg((r.matched_promise + r.landlord_rating + r.neighborhood_rating) / 3.0), 1),
    round(avg(r.matched_promise), 1),
    round(avg(r.landlord_rating), 1),
    round(avg(r.neighborhood_rating), 1),
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

create or replace function public.get_property(p_id uuid)
returns table (
  id                  uuid,
  name                text,
  address             text,
  neighborhood        text,
  landlord_name       text,
  monthly_rent_rwf    integer,
  furnished           boolean,
  photo_url           text,
  review_count        bigint,
  avg_overall         numeric,
  avg_matched_promise numeric,
  avg_landlord        numeric,
  avg_neighborhood    numeric,
  deposit_fair_pct    numeric,
  created_at          timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.name, p.address, n.name, l.name, p.monthly_rent_rwf, p.furnished, p.photo_url,
    count(r.id),
    round(avg((r.matched_promise + r.landlord_rating + r.neighborhood_rating) / 3.0), 1),
    round(avg(r.matched_promise), 1),
    round(avg(r.landlord_rating), 1),
    round(avg(r.neighborhood_rating), 1),
    round(100.0 * count(r.id) filter (where r.deposit_outcome = 'full')
          / nullif(count(r.id) filter (where r.deposit_outcome <> 'not_yet'), 0)),
    p.created_at
  from public.properties p
  left join public.neighborhoods n on n.id = p.neighborhood_id
  left join public.landlords l on l.id = p.landlord_id
  left join public.reviews r on r.property_id = p.id and r.status = 'approved'
  where p.id = p_id and p.is_published
  group by p.id, n.name, l.name;
$$;

revoke execute on function public.search_properties(text) from public;
revoke execute on function public.get_property(uuid) from public;
grant execute on function public.search_properties(text) to anon, authenticated;
grant execute on function public.get_property(uuid) to anon, authenticated;

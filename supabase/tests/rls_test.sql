-- Exercises the trust rules against a database loaded with shim + migration + seed.
-- Run with:  psql -v ON_ERROR_STOP=1 -f rls_test.sql
\set QUIET on
\pset pager off

-- Users
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'amara@alu.test', '{"full_name":"Amara Student"}'),
  ('22222222-2222-2222-2222-222222222222', 'kofi@alu.test',  '{"full_name":"Kofi Student"}'),
  ('33333333-3333-3333-3333-333333333333', 'admin@fmh.test', '{"full_name":"FMH Admin"}');
update public.profiles set role = 'admin' where id = '33333333-3333-3333-3333-333333333333';

-- Amara's proof upload (as storage would record it)
insert into storage.objects (bucket_id, name, owner_id) values
  ('tenancy-proofs', '11111111-1111-1111-1111-111111111111/lease.pdf', '11111111-1111-1111-1111-111111111111'),
  ('tenancy-proofs', '22222222-2222-2222-2222-222222222222/lease.pdf', '22222222-2222-2222-2222-222222222222');

create or replace function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin
  if not cond then raise exception 'FAIL: %', label; end if;
  raise notice 'ok  %', label;
end $$;

-- ---------- Guest ----------
set role anon;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.check((select count(*) from public.search_properties('')) = 4, 'guest can search all published properties');
select pg_temp.check((select count(*) from public.search_properties('gacuriro')) = 1, 'search matches neighbourhood name');
select pg_temp.check((select review_count from public.search_properties('Sunrise')) = 1, 'search returns approved review count');
select pg_temp.check((select count(*) from public.reviews) = 0, 'guest cannot read reviews table directly');

do $$ begin
  perform public.submit_review(null, 'X', '', '{"listing_accuracy":"as_advertised","deposit_outcome":"full","landlord_agreement":"yes","landlord_repairs":"yes","landlord_notice":"yes","landlord_respect":"yes","area_safety":"safe","area_noise":"quiet","area_utilities":"reliable","recommendation":"recommend"}'::jsonb, null, null, 'lease', 'x/y.pdf');
  raise exception 'FAIL: guest submitted review';
exception when insufficient_privilege then raise notice 'ok  guest cannot submit a review';
end $$;

-- ---------- Student Amara ----------
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

do $$ begin
  insert into public.reviews (property_id, author_id, source, status, listing_accuracy, deposit_outcome, recommendation)
  values ('00000000-0000-0000-0000-0000000000c1', auth.uid(), 'student', 'approved', 'as_advertised', 'full', 'recommend');
  raise exception 'FAIL: direct insert allowed';
exception when insufficient_privilege then raise notice 'ok  student cannot insert (or self-approve) reviews directly';
end $$;

do $$ begin
  perform public.submit_review('00000000-0000-0000-0000-0000000000c1', null, null, '{"listing_accuracy":"as_advertised","deposit_outcome":"full","landlord_agreement":"yes","landlord_repairs":"yes","landlord_notice":"yes","landlord_respect":"yes","area_safety":"safe","area_noise":"quiet","area_utilities":"reliable","recommendation":"recommend"}'::jsonb, null, null, 'lease',
    '22222222-2222-2222-2222-222222222222/lease.pdf');
  raise exception 'FAIL: used someone else''s proof';
exception when invalid_parameter_value then raise notice 'ok  student cannot attach another user''s proof';
end $$;

do $$ begin
  perform public.submit_review('00000000-0000-0000-0000-0000000000c1', null, null, '{"listing_accuracy":"as_advertised","deposit_outcome":"full","landlord_agreement":"yes","landlord_repairs":"yes","landlord_notice":"yes","landlord_respect":"yes","area_safety":"safe","area_noise":"quiet","area_utilities":"reliable","recommendation":"recommend"}'::jsonb, null, null, 'lease', null);
  raise exception 'FAIL: review without proof';
exception when invalid_parameter_value then raise notice 'ok  review without proof is refused';
end $$;

do $$ begin
  perform public.submit_review('00000000-0000-0000-0000-0000000000c1', null, null, '{"listing_accuracy":"as_advertised"}'::jsonb, null, null, 'lease',
    '11111111-1111-1111-1111-111111111111/lease.pdf');
  raise exception 'FAIL: incomplete answers accepted';
exception when invalid_parameter_value then raise notice 'ok  incomplete answers are refused';
end $$;

do $$ begin
  perform public.submit_review('00000000-0000-0000-0000-0000000000c1', null, null, jsonb_set('{"listing_accuracy":"as_advertised","deposit_outcome":"full","landlord_agreement":"yes","landlord_repairs":"yes","landlord_notice":"yes","landlord_respect":"yes","area_safety":"safe","area_noise":"quiet","area_utilities":"reliable","recommendation":"recommend"}'::jsonb, '{recommendation}', '"maybe"'), null, null, 'lease',
    '11111111-1111-1111-1111-111111111111/lease.pdf');
  raise exception 'FAIL: invalid answer accepted';
exception when check_violation then raise notice 'ok  invalid answer values are refused';
end $$;


select public.submit_review('00000000-0000-0000-0000-0000000000c4', null, null, '{"listing_accuracy":"not_as_advertised","listing_issues":["condition","water"],"listing_notes":"Leaking roof","deposit_outcome":"none","deposit_reason_given":false,"deposit_notes":"Kept all of it","landlord_agreement":"no","landlord_repairs":"no","landlord_notice":"na","landlord_respect":"no","area_safety":"unsafe","area_noise":"disruptive","area_utilities":"frequent","recommendation":"not_recommend","overall_comment":"Avoid"}'::jsonb, '2025-01-01', '2025-10-01', 'lease',
  '11111111-1111-1111-1111-111111111111/lease.pdf') as amara_review \gset

select pg_temp.check((select status from public.reviews where id = :'amara_review') = 'pending', 'new review is pending (NFR 9)');
select pg_temp.check((select review_count from public.get_property('00000000-0000-0000-0000-0000000000c4')) = 0, 'pending review is not public');
select pg_temp.check((select count(*) from public.residency_proofs) = 0, 'student cannot read proof rows');
select pg_temp.check((select count(*) from storage.objects) = 0, 'student cannot read proof files');
select pg_temp.check((select count(*) from public.profiles) = 1, 'student sees only own profile');

do $$ begin
  update public.profiles set role = 'admin' where id = auth.uid();
  raise exception 'FAIL: role escalation';
exception when insufficient_privilege then raise notice 'ok  student cannot make themselves admin';
end $$;

do $$ begin
  perform public.moderate_review((select id from public.reviews limit 1), true, null);
  raise exception 'FAIL: student moderated';
exception when insufficient_privilege then raise notice 'ok  student cannot approve reviews';
end $$;

-- ---------- Student Kofi ----------
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select pg_temp.check((select count(*) from public.reviews) = 0, 'other students cannot see pending reviews');

-- Kofi suggests a property that isn't listed yet
select public.submit_review(null, 'Blue Door Flats', 'KG 30 St', '{"listing_accuracy":"as_advertised","deposit_outcome":"not_yet","landlord_agreement":"yes","landlord_repairs":"na","landlord_notice":"yes","landlord_respect":"yes","area_safety":"safe","area_noise":"quiet","area_utilities":"reliable","recommendation":"recommend"}'::jsonb, '2026-01-01', null, 'landlord_confirmation',
  '22222222-2222-2222-2222-222222222222/lease.pdf') as kofi_review \gset
select pg_temp.check((select count(*) from public.search_properties('Blue Door')) = 0, 'student-suggested property hidden until approval');

-- ---------- Admin ----------
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select pg_temp.check((select count(*) from public.reviews where status = 'pending') = 2, 'admin sees pending queue');
select pg_temp.check((select count(*) from storage.objects) = 2, 'admin can read proof files');

do $$ begin
  perform public.moderate_review((select id from public.reviews where status='pending' limit 1), false, '  ');
  raise exception 'FAIL: rejected without reason';
exception when invalid_parameter_value then raise notice 'ok  rejection requires a reason';
end $$;

select public.moderate_review(:'amara_review', true, null);
select public.moderate_review(:'kofi_review', false, 'Landlord confirmation was unsigned.');

select pg_temp.check((select review_count from public.get_property('00000000-0000-0000-0000-0000000000c4')) = 1, 'approved review becomes public');
select pg_temp.check((select recommend_answered = 1 and recommend_yes = 0 and agreement_answered = 1 and notice_answered = 0
                       and safety_safe = 0 and safety_answered = 1
                       from public.get_property('00000000-0000-0000-0000-0000000000c4')), 'property summary tallies structured answers (n/a excluded)');
select pg_temp.check((select ref_no from public.reviews where id = :'kofi_review') > (select ref_no from public.reviews where id = :'amara_review'), 'reviews get increasing reference numbers');
select pg_temp.check((select verified from public.residency_proofs p join public.reviews r on r.id = p.review_id where r.id = :'amara_review'), 'proof marked verified');

do $$ begin
  perform public.moderate_review((select id from public.reviews where status='approved' and source='student' limit 1), false, 'again');
  raise exception 'FAIL: re-moderated';
exception when invalid_parameter_value then raise notice 'ok  decided reviews cannot be re-moderated';
end $$;

do $$ begin
  perform public.admin_add_review('00000000-0000-0000-0000-0000000000c2', '{"listing_accuracy":"as_advertised","deposit_outcome":"full","landlord_agreement":"yes","landlord_repairs":"yes","landlord_notice":"yes","landlord_respect":"yes","area_safety":"safe","area_noise":"quiet","area_utilities":"reliable","recommendation":"recommend"}'::jsonb, null, null, '  ');
  raise exception 'FAIL: manual review without collection note';
exception when invalid_parameter_value then raise notice 'ok  manual review requires a collection note';
end $$;
select public.admin_add_review('00000000-0000-0000-0000-0000000000c2', '{"listing_accuracy":"as_advertised","deposit_outcome":"full","landlord_agreement":"yes","landlord_repairs":"yes","landlord_notice":"yes","landlord_respect":"yes","area_safety":"safe","area_noise":"quiet","area_utilities":"reliable","recommendation":"recommend"}'::jsonb, null, null, 'Interviewed in person 12 Nov') as manual \gset
select pg_temp.check((select source from public.reviews where id = :'manual') = 'admin_manual', 'manual review labelled as such (NFR 6)');
select pg_temp.check((select count(*) from public.review_events) = 5, 'audit log has 5 events');

-- ---------- Public view after decisions ----------
reset role; set role anon;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.check(
  not exists (
    select 1 from pg_proc, unnest(proargnames) a
    where proname = 'get_property_reviews' and a in ('author_id', 'full_name', 'entered_by', 'reviewed_by')
  ), 'public review API exposes no author columns');
select pg_temp.check((select count(*) from public.get_property_reviews('00000000-0000-0000-0000-0000000000c4')) = 1, 'guest sees approved student review');

-- Students see their own decision + reason (sequence diagram step 7)
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select pg_temp.check((select rejection_reason from public.reviews where id = :'kofi_review') = 'Landlord confirmation was unsigned.', 'student sees rejection reason');
select pg_temp.check((select count(*) from public.review_events) = 0, 'student cannot read audit log');


-- ---------- Property photos ----------
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ begin
  insert into storage.objects (bucket_id, name, owner_id) values ('property-photos', 'x.jpg', auth.uid()::text);
  raise exception 'FAIL: student uploaded property photo';
exception when insufficient_privilege then raise notice 'ok  students cannot upload property photos';
end $$;
do $$ begin
  update public.properties set photo_url = 'https://evil' where true;
  if exists (select 1 from public.properties where photo_url = 'https://evil') then
    raise exception 'FAIL: student changed photo';
  end if;
  raise notice 'ok  students cannot change property photos';
end $$;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
update public.properties set photo_url = 'https://x.supabase.co/storage/v1/object/public/property-photos/c1.jpg'
 where id = '00000000-0000-0000-0000-0000000000c1';
reset role; set role anon;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.check((select photo_url from public.get_property('00000000-0000-0000-0000-0000000000c1')) like '%c1.jpg', 'guest sees property photo');
select pg_temp.check((select recommend_pct from public.search_properties('Sunrise')) = 100, 'search returns recommendation rate');
select pg_temp.check((select accurate_pct from public.search_properties('Hillview')) = 50, 'search returns listing accuracy rate');

-- ---------- Notifications ----------
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select pg_temp.check((select count(*) from public.notifications) = 1, 'student sees only their own notification');
select pg_temp.check((select kind from public.notifications) = 'review_approved', 'approval creates a notification');
do $$ begin
  insert into public.notifications (user_id, kind, title, body) values (auth.uid(), 'review_approved', 'x', 'x');
  raise exception 'FAIL: student created a notification';
exception when insufficient_privilege then raise notice 'ok  students cannot create notifications';
end $$;
select public.mark_notifications_read(null);
select pg_temp.check((select read_at is not null from public.notifications), 'student can mark notifications read');
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select pg_temp.check((select body like '%Landlord confirmation was unsigned.%' and kind = 'review_rejected' from public.notifications), 'decline notification includes the reason');

-- ---------- No self-approval ----------
reset role;
insert into storage.objects (bucket_id, name, owner_id)
values ('tenancy-proofs', '33333333-3333-3333-3333-333333333333/lease.pdf', '33333333-3333-3333-3333-333333333333');
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select public.submit_review('00000000-0000-0000-0000-0000000000c3', null, null, '{"listing_accuracy":"as_advertised","deposit_outcome":"full","landlord_agreement":"yes","landlord_repairs":"yes","landlord_notice":"yes","landlord_respect":"yes","area_safety":"safe","area_noise":"quiet","area_utilities":"reliable","recommendation":"recommend"}'::jsonb, null, null, 'lease',
  '33333333-3333-3333-3333-333333333333/lease.pdf') as admin_review \gset
do $$ begin
  perform public.moderate_review((select id from public.reviews where author_id = auth.uid() and status = 'pending'), true, null);
  raise exception 'FAIL: admin approved own review';
exception when insufficient_privilege then raise notice 'ok  admins cannot verify their own reviews';
end $$;

-- ---------- Landlord contacts ----------
insert into public.landlord_contacts (landlord_id, phone) values ('00000000-0000-0000-0000-0000000000b1', '+250 788 123 456');
reset role; set role anon;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.check(public.landlord_contact_available('00000000-0000-0000-0000-0000000000c1'), 'guest can see that a contact exists');
select pg_temp.check(not public.landlord_contact_available('00000000-0000-0000-0000-0000000000c2'), 'contact availability is per landlord');
select pg_temp.check((select count(*) from public.landlord_contacts) = 0, 'guest cannot read landlord phone numbers');
do $$ begin
  perform public.get_landlord_contact('00000000-0000-0000-0000-0000000000c1');
  raise exception 'FAIL: guest got landlord contact';
exception when insufficient_privilege then raise notice 'ok  guest must sign in to get a landlord contact';
end $$;
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select pg_temp.check((select count(*) from public.landlord_contacts) = 0, 'student cannot list landlord phone numbers');
select pg_temp.check((select phone from public.get_landlord_contact('00000000-0000-0000-0000-0000000000c1')) = '+250 788 123 456', 'signed-in student gets the contact for one property');
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select pg_temp.check((select count(*) from public.contact_requests) = 1, 'contact requests are logged for the team');

-- ---------- Evidence clean-up ----------
select pg_temp.check((select count(*) from public.admin_stale_proof_files() where path like '22222222%') = 1, 'declined review evidence is listed for removal');
select pg_temp.check((select count(*) from public.admin_stale_proof_files() where path like '11111111%') = 0, 'approved review evidence is kept');
select public.admin_mark_proofs_removed(array['22222222-2222-2222-2222-222222222222/lease.pdf']);
select pg_temp.check((select file_removed_at is not null from public.residency_proofs where storage_path like '22222222%'), 'removal is recorded on the proof');
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ begin
  perform public.admin_stale_proof_files();
  raise exception 'FAIL: student listed evidence files';
exception when insufficient_privilege then raise notice 'ok  students cannot manage evidence files';
end $$;

\echo ALL CHECKS PASSED

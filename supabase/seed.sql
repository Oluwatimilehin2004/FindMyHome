-- DEMO DATA ONLY — for local development and screenshots.
-- Every name below is invented. Do not load this into the beachhead/production project;
-- real early reviews are entered by the team through the in-app "Add early review" screen (FR 5.2).

insert into public.neighborhoods (id, name, district) values
  ('00000000-0000-0000-0000-0000000000a1', 'Kagugu',     'Gasabo'),
  ('00000000-0000-0000-0000-0000000000a2', 'Gacuriro',   'Gasabo'),
  ('00000000-0000-0000-0000-0000000000a3', 'Kibagabaga', 'Gasabo'),
  ('00000000-0000-0000-0000-0000000000a4', 'Kimironko',  'Gasabo'),
  ('00000000-0000-0000-0000-0000000000a5', 'Batsinda',   'Gasabo')
on conflict do nothing;

insert into public.landlords (id, name) values
  ('00000000-0000-0000-0000-0000000000b1', 'Demo Landlord A'),
  ('00000000-0000-0000-0000-0000000000b2', 'Demo Landlord B'),
  ('00000000-0000-0000-0000-0000000000b3', 'Demo Landlord C')
on conflict do nothing;

insert into public.properties (id, name, address, neighborhood_id, landlord_id, monthly_rent_rwf, furnished) values
  ('00000000-0000-0000-0000-0000000000c1', 'Sunrise Apartments (demo)', 'KG 9 Ave, Kagugu',      '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 250000, true),
  ('00000000-0000-0000-0000-0000000000c2', 'Hillview Compound (demo)',  'KG 544 St, Gacuriro',   '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b2', 180000, false),
  ('00000000-0000-0000-0000-0000000000c3', 'Green Gate House (demo)',   'KG 17 Ave, Kibagabaga', '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b3', 320000, true),
  ('00000000-0000-0000-0000-0000000000c4', 'Market Lane Rooms (demo)',  'KG 11 Ave, Kimironko',  '00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000b1', 120000, false)
on conflict do nothing;

insert into public.reviews (
  property_id, source, status,
  listing_accuracy, listing_issues, matched_promise_notes,
  deposit_outcome, deposit_reason_given, deposit_return_time, deposit_notes,
  landlord_agreement, landlord_repairs, landlord_notice, landlord_respect, landlord_notes,
  area_safety, area_noise, area_utilities, neighborhood_notes,
  recommendation, overall_comment, tenancy_start, tenancy_end, reviewed_at
) values
  ('00000000-0000-0000-0000-0000000000c1', 'admin_manual', 'approved',
   'minor_differences', '{water}', 'Furniture matched the photographs. The water heater was slower than described.',
   'full', null, 'under_2_weeks', 'The deposit was returned within two weeks of moving out.',
   'yes', 'yes', 'yes', 'yes', 'Responded promptly and repaired the sink within the same week.',
   'safe', 'quiet', 'reliable', 'Quiet at night; a short moto ride to campus.',
   'recommend', 'I would rent here again.', '2025-01-01', '2025-12-01', now()),
  ('00000000-0000-0000-0000-0000000000c2', 'admin_manual', 'approved',
   'significant_differences', '{furnishing,charges}', 'The refrigerator and television shown at the viewing were removed before move-in and were not listed in the contract.',
   'partial', false, '2_to_4_weeks', 'Half of the deposit was withheld for painting, with no receipts provided.',
   'no', 'no', 'yes', 'no', 'Difficult to reach; attributed every issue to the agent.',
   'some_concerns', 'moderate', 'occasional', 'The compound gate is not always locked.',
   'not_recommend', 'Ensure every appliance is written into the lease.', '2024-09-01', '2025-08-01', now()),
  ('00000000-0000-0000-0000-0000000000c3', 'admin_manual', 'approved',
   'as_advertised', '{}', 'The property was exactly as advertised.',
   'not_yet', null, null, 'Current tenant.',
   'yes', 'yes', 'yes', 'yes', 'Fair, and expects rent strictly on the first of the month.',
   'safe', 'quiet', 'reliable', 'Safe, well-lit street.',
   'recommend', '', '2025-06-01', null, now());


supabase/migrations/20261123000000_structured_reviews.sql

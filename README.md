# FindMyHome (FMH): MVP

Verified, tenant-sourced information about a property, its landlord and its neighbourhood. It is for ALU students in Kigali to read *before* they pay.

This README covers the first release described in the SRS (29 Sept 2026). Nothing in the app comes from outside that scope: there are no landlord accounts, payments, maps, chat or push notifications.

## Stack

| Layer | Choice | SRS ref |
|---|---|---|
| App | React Native + Expo SDK 58, TypeScript, expo-router | §2.4, §2.5 |
| Backend | Supabase: Postgres, Auth (email + password, hashed), Storage | §2.4, §3.3, §5.3 |
| Transport | HTTPS / JSON | NFR 1, §3.4 |
| Distribution | EAS Build → Google Play Internal Testing + Apple TestFlight | §2.4 |

## Where each requirement lives

| Requirement | Implementation |
|---|---|
| FR 1.1 / 1.2 Account | `src/app/auth/*`, `src/lib/auth.tsx` |
| FR 2.1 / 2.2 Search | `src/app/(tabs)/index.tsx` → `search_properties()` |
| FR 3.1 / 3.2 Verified reviews, structured assessment | `src/app/property/[id].tsx` (verification summary), `src/components/ReviewCard.tsx` → `get_property()`, `get_property_reviews()` |
| FR 4.1 / 4.2 Submit + proof | `src/app/(tabs)/submit.tsx`, `src/components/ReviewForm.tsx` → upload to private bucket, then `submit_review()` |
| Track status (use case, sequence diagram step 7) | `src/app/(tabs)/my-reviews.tsx` (reference number + status timeline) |
| FR 5.1 Approve / reject | `src/app/(tabs)/admin.tsx`, `src/app/admin/review/[id].tsx` → `moderate_review()` |
| FR 5.2 Manual early reviews | `src/app/admin/add-review.tsx` → `admin_add_review()` |
| Add property (use case) | `src/app/admin/add-property.tsx` |
| FR 6.1 Help/FAQ, FR 6.2 Onboarding | `src/components/HelpSheet.tsx` (“?” button on every main screen), `src/app/onboarding.tsx` |
| NFR 2 Proofs admin-only | Private `tenancy-proofs` bucket. Students can upload but not read. Admins open proofs through 5-minute signed URLs |
| NFR 5 Plain errors on the same screen | `friendlyError()` in `src/lib/api.ts` + `<ErrorText>` |
| NFR 6 Audit trail | `reviews.source` (`student` / `admin_manual`) + `review_events` table |
| NFR 9 Pending, not error | New reviews are always `pending`, and the student sees "Awaiting verification" |
| §5.2 Reviewer anonymity | The public functions never return the author, their name or exact dates; only the year is shown |
| §5.5 No proof → no review | `submit_review()` refuses a submission without the student's own uploaded file, and `moderate_review()` refuses to approve one without proof |

The trust rules are enforced **in the database**, through row-level security and `SECURITY DEFINER` functions, not just in the UI. `supabase/tests/rls_test.sql` checks 56 of them, for example: "a student cannot self-approve", "a student cannot attach another user's proof", "a guest cannot read pending reviews" and "a student cannot make themselves admin".

## Setup

### 1. Supabase project
1. Create a project at supabase.com.
2. Open **SQL Editor** and run each file in `supabase/migrations/` **in order**: `20261119000000_init.sql`, `20261119010000_property_photos.sql`, `20261123000000_structured_reviews.sql`, then `20261124000000_notifications_contacts_cleanup.sql`. If you have the Supabase CLI, `supabase db push` does the same.
3. Optionally, run `supabase/seed.sql` for **demo** data. Every name in it is invented, so don't use it for the real beachhead.
4. Go to **Authentication → Providers → Email** and turn **off** "Confirm email". SRS §3.4 says there is no email verification in this release.
5. Make yourself an admin. Sign up in the app first, then run:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

### 2. App
```bash
cp .env.example .env          # paste your project URL and anon key (Settings → API)
npm install
npx expo start                # scan the QR code with Expo Go
```

### 3. Beta distribution (§2.4)
```bash
npx eas-cli@latest build --profile preview --platform all
npx eas-cli@latest submit --profile preview --platform android   # Internal Testing track
npx eas-cli@latest submit --platform ios       # TestFlight
```

## Tests

```bash
# Database trust rules against a throwaway local Postgres. Needs the postgres binaries.
# Run it as a non-root user.
bash supabase/tests/run.sh

npx tsc --noEmit              # typecheck
```

## Reviews

Reviews are a structured tenancy assessment rather than star ratings. Each review records:

1. **Accuracy of the listing**: as advertised / minor / significant differences / not as advertised, plus which aspects differed.
2. **Security deposit**: outcome, whether a written reason was given for deductions, and how long the return took.
3. **Landlord conduct**: four statements answered Yes / No / Not applicable.
4. **Neighbourhood**: safety, noise, and reliability of water and electricity.
5. **Tenancy period** (only the year is published).
6. **Recommendation**: recommend / with reservations / not recommend.

The property page turns these into a verification summary ("4 of 5 verified tenants…"). Every review gets a reference number (`FMH-2026-0012`), shown in My reviews and the verification queue.

## Notifications

When the team approves or declines a review, `moderate_review()` writes a row to `notifications`. While the app is open, the row arrives instantly through Supabase Realtime, and the student gets a phone notification and an unread badge on the bell icon (`src/lib/notifications.tsx`, `src/app/notifications.tsx`). Decisions made while the app was closed are shown the next time it opens. Push notifications to a fully closed app need an EAS build with an Expo project ID and a push sender; they are not set up yet.

## Verification rules added

- Admins cannot verify their own submissions; another team member must.
- **Decision history** (Verification tab) lists approved and declined reviews with who decided and when.
- Declining a review deletes its evidence file. **Check storage** in Decision history finds and removes evidence of declined reviews and files with no review.

## Landlord contact

Admins store the landlord's phone number on the property form; it lives in `landlord_contacts`, which only admins can read. On the property page, **Contact the landlord** asks guests to sign in; signed-in users reveal the number for that one property through `get_landlord_contact()`, which logs every request in `contact_requests` and limits each user to 20 a day.

## Keeping the free Supabase project awake

Free projects pause after 7 days without activity. `.github/workflows/keep-supabase-awake.yml` calls the database every 3 days. Add the repository secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY` (Settings → Secrets and variables → Actions). GitHub stops scheduled workflows after 60 days without commits to the repository.

## Design

Warm greige canvas, off-white cards, a single near-black ink, and the Inter typeface. Navigation is a floating pill tab bar (Explore, My reviews, and Verification for admins) next to a dark round **+** button for submitting a review. Help is a bottom sheet opened from the **?** button in each screen header. Tokens live in `src/theme.ts`, and the shared building blocks in `src/components/ui.tsx`.

Admins add cover photos when they create a property, or later with the camera button on a property page. Photos go into the public `property-photos` bucket.

## Decisions and open questions

- **Landlord phone number is not built.** The use-case diagram has "View landlord contact number", but SRS §5.2 rules out contact-sharing. Decide which one wins before adding it.
- **Guest browsing is allowed.** SRS §5.3 lets guests search and read verified reviews; an account is required only to submit.
- **Properties suggested by students** stay hidden from search until the team approves a review for them.
- **48-hour turnaround (§5.1):** the queue colours a review amber after 24 hours and red after 48. There are no push notifications yet, so students check My reviews themselves.
- **Data protection (§5.3):** sign-up asks for consent, in line with Rwanda's Personal Data Protection Law (2021), and collects only name, email and international status.
- **Proof files** are not deleted automatically when a review is deleted. An admin must remove them from Storage. This is worth adding a scheduled cleanup before public launch.

# Homegrown.ai — Architecture & MVP Context

## What this is
AI-native platform connecting BOCES graduates to local employers in rural upstate New York. Hyperlocal rural workforce pipeline built on certification matching — employers post jobs with required certs, students see green (have it) or gray (missing) boxes, and apply accordingly.

**Core problem:** BOCES produces skilled graduates but has no systematic way to connect them to local employers. Rural hiring runs on word of mouth. Information asymmetry is the root issue.

---

## MVP Scope (BOCES-only)

### Who it's for
- **Students:** BOCES graduates and current students ONLY. Not community college, not military, not "any local." This is the MVP — keep it focused.
- **Employers:** Local businesses hiring trades/skilled labor in upstate NY counties.

### What it does (keep)
- Student signup → onboarding → job feed with cert matching
- Employer signup → setup → job posting → dashboard
- Cert matching: green = have it, gray = missing
- Application flow with availability, logistics, background questions
- In-app messaging between employer and student
- Employer applicant view with cert match data

### What it does NOT do (do not add without user evidence)
- AI job description rewriting (removed — add back later)
- Community college / military / veteran onboarding paths
- Push notifications
- Pagination (jobs load all at once — fine at this scale)
- "Any background welcome" framing
- Per-project pay
- Photo upload for students (nice to have, not core)

---

## Tech Stack
- **Frontend:** Vanilla HTML/CSS/JS — no framework, no build step, no bundler
- **Database + Auth:** Supabase (project: mccrpgqtqtrxfifxvwbd.supabase.co)
- **Hosting:** Vercel (static files + one serverless function)
- **Version control:** GitHub
- **AI:** Claude API via /api/transform.js (Vercel serverless, server-side only)
- **Font:** Plus Jakarta Sans (Google Fonts CDN)
- **Supabase client:** cdn.jsdelivr.net/npm/@supabase/supabase-js@2

### Colors
- Primary green: `#3B6D11`
- Light green: `#EAF3DE`
- Warm white (background): `#FAFAF8`
- Warm black: `#1C1C1A`
- Logo: Seedling SVG

---

## File Structure
```
/
├── CLAUDE.md                  ← this file
├── index.html                 ← landing page + auth hub (signup/signin, both roles)
├── shared/
│   └── styles.css             ← shared base styles (header, sheet overlays, app chrome)
├── student/
│   ├── onboarding.html        ← 5-step post-signup: background → program → certs → county → grad year
│   ├── dashboard.html         ← job feed, apply flow, messaging inbox (~1,692 lines — refactor candidate)
│   └── company.html           ← employer "About" page shown from job card
├── employer/
│   ├── onboarding.html        ← legacy, mostly superseded by setup.html
│   ├── setup.html             ← 3-step post-signup: profile → hiring needs → how to hire
│   └── dashboard.html         ← My Jobs, post/edit jobs, applicants, messaging (~1,763 lines — refactor candidate)
├── admin/
│   └── jobs.html              ← password-protected (homegrown2026) admin panel
└── api/
    └── transform.js           ← Vercel serverless: raw description → Claude API → student-friendly rewrite
```

---

## Auth Architecture

### How it works
- Supabase Auth, email + password only (no OAuth, no magic link)
- `user_metadata.user_type` = `'student'` or `'employer'` — set at signup, used for routing
- **Email confirmation is OFF** — must be turned ON before any real users touch the app
- No server-side route protection — dashboards do client-side session check only
- Profile data cached in `localStorage` as `hg_profile` (name, county, avatar_url, phone)

### Student signup flow
`index.html` → collects first name, last name, phone, email, password → `auth.signUp()` → `/student/onboarding.html`

### Employer signup flow
`index.html` → collects company name, email, password, county → `auth.signUp()` + `employers.upsert()` → `/employer/setup.html`

### Sign in flow
`auth.signInWithPassword()` → redirect to dashboard based on `user_type`

### Known auth issues to fix before launch
- [ ] Enable email confirmation in Supabase dashboard
- [ ] **Reset sign-up rate limit** — currently set to 10,000/5min for dev; set back to 30 at supabase.com/dashboard/project/mccrpgqtqtrxfifxvwbd/auth/rate-limits
- [ ] Add role enforcement on dashboards — employer navigating to `/student/dashboard.html` currently sees student view
- [ ] Employer is identified by `session.user.email` not `auth.uid()` — fix to use auth id

---

## Supabase Schema

### Architecture rules
- Use `auth.uid()` for all RLS policies — never identify users by email
- `jobs.id` is `bigint` (NOT uuid — previous CLAUDE.md was wrong, this is the correction)
- Employer → jobs relationship: employer posts jobs, jobs must have `employer_id` = auth uid
- All RLS must be ON before launch — currently most tables are wide open

### `students` table
| Column | Type | Notes |
|---|---|---|
| id | uuid | = auth.uid() |
| first_name | text | added via migration |
| last_name | text | added via migration |
| phone | text | added via migration |
| program | text | BOCES program name |
| graduation_year | text | stored as text, not int |
| certifications | text[] | array of cert names |
| county | text | added via migration; format: "Chenango County, NY" |
| created_at | timestamp | |

### `employers` table
| Column | Type | Notes |
|---|---|---|
| id | bigint | auto-increment (NOT auth.uid()) |
| user_id | uuid | = auth.uid() — used for RLS and all auth checks |
| email | text | unique — used as upsert conflict key |
| company_name | text | |
| county | text | format: "Chenango County, NY" |
| industry | text | |
| company_size | text | "1–10", "11–50", "51–200", "200+" |
| website | text | optional |
| description | text | "What do you do?" 1-2 sentences |
| logo_url | text | optional, Supabase Storage |
| application_method | text | how employer wants to receive applicants |
| contact_name | text | hiring contact |
| contact_phone | text | hiring contact phone |
| ats_url | text | if using external ATS |
| created_at | timestamp | |

### `jobs` table
| Column | Type | Notes |
|---|---|---|
| id | bigint | auto-increment |
| employer_id | uuid | = auth.uid() of posting employer — added via migration |
| company_name | text | denormalized for display |
| role_title | text | |
| city | text | used for location display (maps to county/city field in UI) |
| state | text | |
| distance | text | display distance string |
| pay | text | formatted string e.g. "$18–$28/hr" (NOT pay_min/pay_max ints) |
| shift_type | text | "1st shift (7am–3pm)" etc |
| is_union | boolean | |
| benefits | text | |
| sign_on_bonus | text | |
| certifications_required | text[] | drives cert matching |
| target_industries | text[] | |
| sponsors_certifications | boolean | will pay for training |
| offers_apprenticeships | boolean | |
| employer_description | text | raw description |
| student_description | text | same as employer_description for now |
| is_active | boolean | default true |
| created_at | timestamp | |

### `applications` table
| Column | Type | Notes |
|---|---|---|
| id | bigint | auto-increment |
| job_id | bigint | |
| student_id | uuid | = auth.uid() |
| student_name | text | denormalized |
| student_email | text | denormalized |
| student_phone | text | denormalized |
| student_county | text | denormalized |
| certifications | text[] | snapshot of student certs at apply time |
| status | text | default "pending" |
| start_when | text | |
| shifts | text[] | |
| employment_type | text | |
| can_overtime | boolean | |
| has_transportation | boolean | |
| has_license | boolean | |
| prior_experience | text | |
| employer_note | text | |
| created_at | timestamp | |
| UNIQUE | (job_id, student_id) | one application per student per job |

### `chat_messages` table
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| job_id | bigint | |
| student_id | uuid | |
| sender_role | text | "student" or "employer" (column is sender_role, NOT sender) |
| body | text | message content (column is body, NOT content) |
| read_at | timestamp | |
| created_at | timestamp | |
| Realtime | ON | |

---

## RLS Policies (required before launch)

All tables must have RLS ON. Required policies:

### students
- SELECT: `auth.uid() = id`
- INSERT: `auth.uid() = id`
- UPDATE: `auth.uid() = id`

### employers
- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id`
- UPDATE: `auth.uid() = user_id`

### jobs
- SELECT: public (anyone can read active jobs)
- INSERT: authenticated, `auth.uid() = employer_id`
- UPDATE: `auth.uid() = employer_id`
- DELETE: `auth.uid() = employer_id`

### applications
- SELECT: `auth.uid() = student_id` OR employer can see applications for their jobs
- INSERT: `auth.uid() = student_id`
- UPDATE: employer can update status

### chat_messages
- SELECT: `auth.uid() = student_id` OR `auth.uid() = employer_id`
- INSERT: authenticated only
- Current policy (USING true) must be replaced before launch

---

## Cert Matching Logic

This is the core product mechanic — do not change without careful thought.

1. Student selects certifications during onboarding → saved to `students.certifications[]`
2. Employer selects required certs when posting a job → saved to `jobs.certifications_required[]`
3. On job feed load: compare arrays
   - Cert in both arrays → green box (have it)
   - Cert in job but not student → gray box (missing)
4. If all required certs matched → "Apply" button is green and active
5. If any cert missing AND `sponsors_certifications = true` → show "Will pay for your training & certs" badge + "Apply anyway →" with subtext "They'll help you get certified"
6. If any cert missing AND `sponsors_certifications = false` → gray "Get the certifications above to apply" button

### Certification list (canonical — use exactly these strings everywhere)
- OSHA 10 Certification
- Blueprint Reading
- Hand Tool Safety
- IBEW Apprenticeship Application
- Hydraulic Systems Certification
- ServSafe Certification
- NYS CNA License
- Adobe Certified Professional
- CDL License
- Security Guard Certification
- Forklift Operator Certification

---

## Environment Variables

| Variable | Where | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Vercel dashboard (server-side only) | Never expose client-side |
| Supabase URL | Hardcoded in HTML files | `https://mccrpgqtqtrxfifxvwbd.supabase.co` |
| Supabase anon key | Hardcoded in HTML files | Public, acceptable for client-side |

---

## Known Bugs (fix before real users)

1. **Email confirmation is OFF** — turn on in Supabase Auth settings
2. **No role enforcement on dashboards** — add role check on load, redirect if wrong type
3. **RLS is effectively off** — jobs table has RLS disabled; chat_messages has USING(true)
4. **Call button hardcoded** — should pull from `applications.student_phone` not hardcoded number
5. **Employer identified by email not auth id** — fix all employer queries to use `auth.uid()`
6. **Employer has no messages inbox** — can only message from applicant sheet; needs unified inbox
7. **Password validation** — verify 8 char + number + special char requirement is enforced on both signup flows

---

## What NOT to change without asking
- Color scheme (`#3B6D11`, `#EAF3DE`, `#FAFAF8`, `#1C1C1A`)
- Font (Plus Jakarta Sans)
- Supabase table names or column names (unless fixing schema issues noted above)
- Admin panel password (`homegrown2026`)
- The "BOCES" framing — MVP is for BOCES students specifically
- Cert matching logic (green/gray system is the core product)
- The canonical certification list strings (must match exactly between student and job tables)

---

## Session Log
_Update this after each session with what was built, what decisions were made, what assumptions were introduced._

| Date | What changed |
|---|---|
| Session 0 | Architecture doc created. Codebase audited. Known bugs documented. MVP scope locked to BOCES-only. |
| 2026-05-19 | Full audit against CLAUDE.md. Fixed: role enforcement on both dashboards, employer_id everywhere (was using email), job insert now sets employer_id, employer signup upsert uses id. Stripped onboarding to BOCES-only (removed college/military/job paths, industries step). Fixed cert lists in onboarding + dashboard to canonical 11 certs. Added county + student metadata to students upsert in finish(). Call button was already correct. Password validation was already correct. RLS SQL generated separately. |
| 2026-05-19 (cont.) | Schema audit revealed actual DB differs significantly from CLAUDE.md: employers.id is bigint (not uuid), jobs had no employer_id, chat_messages has sender_role/body (not sender/content), students missing first_name/last_name/phone/county. Migration SQL provided to add: employers.user_id (uuid), jobs.employer_id (uuid), students missing columns. Fixed broken code: index.html employer upsert (was inserting uuid into bigint id), employer dashboard profile load/save (now uses user_id). CLAUDE.md updated to match actual schema. |
| 2026-05-20 | Refactor: extracted shared JS modules and per-feature files. Created shared/supabase.js (single _sb client), shared/auth.js (requireAuth + logout), shared/certs.js (ALL_CERTS array). Extracted from student/dashboard.html → student/job-feed.js (renderJobs, esc, formatPay, toggleDesc), student/apply.js (full apply flow), student/messages.js (inbox + chat). Extracted from employer/dashboard.html → employer/jobs.js (loadJobs, renderJobCard, renderPipeline, post/edit sheet, pay slider), employer/applicants.js (applicant sheet), employer/messages.js (employer chat). Both dashboards now load scripts via <script src="..."> tags. Inline script in each dashboard reduced to init IIFE + page-specific functions only. No logic changes. |
| 2026-05-20 (fixes) | Full app audit + 13 bug fixes: (1+2) employer/setup.html finish() — removed non-existent response_time column from upsert (was causing silent fail, profile never saved), added user_id to upsert (dashboard couldn't find profile without it). (4+5) Removed "NYS Cosmetology License" and "CPR / First Aid Certified" from employer/setup.html cert checklist and admin/jobs.html CERTS array — both are absent from ALL_CERTS and student onboarding, so they could never match. (8+9+10) Added <script src="../shared/auth.js"> to employer/setup.html, student/onboarding.html, student/company.html — logout() was undefined on these pages after the refactor. (3) employer/jobs.js renderPipeline() — added comment with required RLS SQL: needs CREATE POLICY "authenticated_read_student_certs" ON students FOR SELECT USING (auth.role() = 'authenticated') before enabling RLS, otherwise pipeline always hides. (7) api/transform.js — fixed invalid Anthropic model ID (claude-sonnet-4-20250514 → claude-sonnet-4-5); AI rewrite was broken for all admin job postings. (11) student/company.html — removed appended " County, NY" from employer county display; county field is already stored as full string so it was doubling (e.g. "Chenango County County, NY"). (12) employer/setup.html — removed address from profile object; no address column in schema, data was silently discarded. (13) index.html — renamed _db → _sb throughout (7 occurrences); all files now use _sb consistently. |
| 2026-05-20 (chat headers + industry) | Chat headers now show who you're actually talking to: student side shows company industry as subtitle (fetched from employers table, falls back to role title if not set); employer side shows student's BOCES program as subtitle (fetched from students table, falls back to role title). Industry is now a required field at employer signup (index.html) — dropdown added before county, value saved to employers.industry. Industry list matches INDUSTRIES array in admin/jobs.html. |
| 2026-05-20 (signup fix) | Fixed account creation broken on both sides. Root cause: Supabase signUp() silently returns { user: null, session: null, error: null } when email already exists (no error thrown — security measure to prevent user enumeration). Code had no null check on data.user/data.session, so it fell through to redirect → onboarding/setup checked !session → redirected back to / → form appeared empty ("resets"). Fix: added null checks for data.user and data.session in both submitStudent and submitEmployer in index.html; shows "An account with this email already exists — use Sign in below." Also added loading state ("Creating account…" + disabled) on both signup buttons so user sees feedback during the async call. |

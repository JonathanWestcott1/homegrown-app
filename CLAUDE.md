# Homegrown.ai — Claude Code Context

## What this project is
A mobile-first web app (max-width 390px) connecting DCMO BOCES vocational students in rural NY with local employers. Built as plain HTML/CSS/JS — no framework, no build step.

## Live URLs
- **Production:** https://homegrown-app-two.vercel.app
- **GitHub:** https://github.com/JonathanWestcott1/homegrown-app
- **Supabase project:** https://supabase.com/dashboard/project/mccrpgqtqtrxfifxvwbd

## Deploy commands
```bash
git add -A && git commit -m "message" && git push && vercel --prod --yes
```

## File structure
```
homegrown-app/
├── index.html                  # Landing page — student + employer signup/signin
├── shared/styles.css           # Shared styles for all app/* pages (app-* classes)
├── student/
│   ├── onboarding.html         # 3-step onboarding: program → grad year → certifications
│   └── dashboard.html          # Student job feed with cert matching
└── employer/
    ├── onboarding.html         # 2-step onboarding: account → job posting via chat UI
    └── dashboard.html          # Employer dashboard: job postings, talent pipeline, chat
```

**Note:** `index.html` has its own large inline `<style>` block (uses `hg-*` classes). The other 4 HTML files use `shared/styles.css` (uses `app-*` classes). These are two separate class namespaces.

## Supabase
- **Project ref:** `mccrpgqtqtrxfifxvwbd`
- **Anon key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jY3JwZ3F0cXRyeGZpZnh2d2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NTAwMDIsImV4cCI6MjA5NDEyNjAwMn0.iB3u2M7H0-D2Z2SbRQN0vHtOB62sASsGeF09FICzcc4`
- **Email confirmation:** OFF (mailer_autoconfirm: true) — disabled to avoid rate limiting during dev

### Database tables

**`public.students`**
```sql
id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
created_at timestamptz DEFAULT now(),
program text,
graduation_year text,
certifications text[]
```
RLS enabled. Policy: users can manage their own row (`auth.uid() = id`).

**`public.employers`**
```sql
id uuid PRIMARY KEY REFERENCES auth.users(id),
created_at timestamptz DEFAULT now(),
company_name text,
county text,
industry text
```

**`public.jobs`**
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
created_at timestamptz DEFAULT now(),
employer_id uuid REFERENCES auth.users(id),
company_name text,
role text,
location text,
pay text,
shift text,
job_type text,
benefits text,
certifications_required text[],
is_active boolean DEFAULT true
```
RLS is UNRESTRICTED on jobs (visible in Supabase as "UNRESTRICTED" badge).

### Supabase client init (used in every file)
```js
const _sb = window.supabase.createClient(
  'https://mccrpgqtqtrxfifxvwbd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // anon key above
);
// index.html uses _db instead of _sb
```

## Auth flow
1. **Landing page** (`index.html`) — user fills name/email/phone/password → `_db.auth.signUp()` → redirects to `/student/onboarding.html`
2. **Student onboarding** — Step 1: BOCES program, Step 2: graduation year, Step 3: certifications → `_sb.from('students').upsert()` → redirects to `/student/dashboard.html`
3. **Student dashboard** — checks session on load, redirects to `/` if none; fetches student certs + active jobs, renders cert-matched job cards
4. **Employer flow** — similar: landing page signup → `/employer/onboarding.html` (chat-style job posting) → `/employer/dashboard.html`
5. **Sign-in** — landing page has a toggle sign-in form for both student and employer using `_db.auth.signInWithPassword()`; routes to correct dashboard based on `user_metadata.user_type`
6. Already-logged-in users are auto-redirected to their dashboard on landing page load

## Design system

### Brand colors
- Primary green: `#3B6D11`
- Light green bg: `#EAF3DE`
- Warm black: `#1C1C1A`
- Warm gray: `#666660`
- Tertiary text: `#B4B2A9`
- Border: `#D3D1C7`
- Page bg: `#FAFAF8`
- Toggle bg: `#EEEEE9`
- Badge border: `#C0DD97`

### Font
`'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif`
Loaded via Google Fonts in every HTML file's `<head>`.

### Logo (used in all 5 files)
```html
<div style="display:flex;align-items:center;gap:7px;">
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 18V10" stroke="#3B6D11" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M11 10C11 10 6 9 5 4C5 4 10 3 13 7C14.5 9 11 10 11 10Z" fill="#3B6D11" opacity="0.9"/>
    <path d="M11 13C11 13 14.5 11.5 17 13C17 13 16 17 13 17.5C11.5 17.7 11 13 11 13Z" fill="#639922" opacity="0.7"/>
  </svg>
  <span style="font-size:16px;font-weight:600;color:#1C1C1A;letter-spacing:-0.4px;">home<span style="color:#3B6D11;">grown</span>.ai</span>
</div>
```

### Beta tag (index.html nav only)
```html
<span style="font-size:11px;font-weight:500;color:#3B6D11;background:#EAF3DE;padding:3px 8px;border-radius:20px;border:0.5px solid #C0DD97;">Beta</span>
```

## Key UX details
- **Checkboxes (certifications):** `✓` is hidden (`color: transparent`) until `.selected` is added — then shows white on green
- **Back buttons:** Steps 2 and 3 of student onboarding have plain text `← Back` buttons calling `showStep(n)`
- **Password strength:** Live checklist (8+ chars, uppercase, lowercase, number, special char) shown on input; eye toggle on all password fields
- **Error messages:** `friendlyError()` in index.html maps raw Supabase errors to human text. Duplicate email shows "An account with this email already exists — use Sign in below."
- **Supabase upsert:** Onboarding uses `upsert` not `insert` to handle users coming from landing page
- **Feature icons:** All 6 feature icons in index.html are Feather-style SVGs (no emojis)

## BOCES programs (used in student onboarding step 1 and index.html)
Automotive Collision & Refinishing, Automotive Technology, Carpentry & Building Construction, Computer Technology & Networking, Conservation & Heavy Equipment, Cosmetology, Culinary Arts, Electrical / IBEW Prep, Nurse Assisting (CNA), Security & Law Enforcement, Visual Communications, Welding Technology

## Certifications list (student onboarding step 3)
OSHA 10 Certification, Blueprint Reading, Hand Tool Safety, IBEW Apprenticeship Application, Hydraulic Systems Certification, ServSafe Certification, NYS CNA License, Adobe Certified Professional, CDL License, Security Guard Certification, Forklift Operator Certification

## What's been built
- [x] Landing page with student + employer signup, sign-in toggle, friendly errors
- [x] Student onboarding (3 steps: program, grad year, certs)
- [x] Student dashboard with real job feed + cert matching (green/gray pills, Apply Now vs locked)
- [x] Employer onboarding (chat-style UI → structured job form → posts to `jobs` table)
- [x] Employer dashboard (job postings, talent pipeline, animated chat demo, Chart.js trend chart)
- [x] Full Supabase auth (signUp, signIn, signOut, session checks, auto-redirect)
- [x] Brand design system (Jakarta font, seedling logo, warm neutrals, SVG icons)

## Pending / not yet done
- [ ] Actual "Apply Now" flow for students (currently just a button, no backend action)
- [ ] Real employer onboarding saving to DB (current onboarding is mostly demo UI)
- [ ] Email notifications
- [ ] Password reset flow
- [ ] Admin dashboard

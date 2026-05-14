# Homegrown.ai — Project Context

## What this is
AI-native platform connecting rural skilled trades workers and BOCES graduates to local employers. Hyperlocal rural workforce pipeline. Think Farmers Business Network but for labor.

**Core problem:** Rural hiring runs on word of mouth. BOCES produces skilled graduates but has no systematic way to connect them to employers. Information asymmetry is the root issue.

---

## Tech Stack
- **Frontend:** Vanilla HTML/CSS/JS — no framework
- **Database + Auth:** Supabase
- **Hosting:** Vercel
- **Version control:** GitHub
- **AI:** Claude API (job description transformation)
- **Font:** Plus Jakarta Sans
- **Colors:**
  - Primary green: `#3B6D11`
  - Light green: `#EAF3DE`
  - Warm white (background): `#FAFAF8`
  - Warm black: `#1C1C1A`
- **Logo:** Seedling SVG

---

## Live URLs
- Demo: `homegrown.vercel.app`
- Real app: `homegrown-app.vercel.app`
- Admin panel: `homegrown-app.vercel.app/admin/jobs.html` (password: `homegrown2026`)

---

## Supabase Schema

### `students`
| Column | Type |
|---|---|
| id | uuid |
| program | text |
| graduation_year | int |
| certifications | text[] |
| created_at | timestamp |

### `employers`
| Column | Type |
|---|---|
| id | uuid |
| company_name | text |
| county | text |
| industry | text |
| created_at | timestamp |

### `jobs`
| Column | Type |
|---|---|
| id | uuid |
| company_name | text |
| role_title | text |
| city | text |
| state | text |
| distance | text |
| pay | text |
| shift_type | text |
| is_union | boolean |
| benefits | text[] |
| sign_on_bonus | text |
| certifications_required | text[] |
| target_industries | text[] |
| employer_description | text |
| student_description | text |
| sponsors_certifications | boolean |
| offers_apprenticeships | boolean |
| is_active | boolean |
| created_at | timestamp |

---

## Key Product Features

### Onboarding
- Step 1 asks: who are you? (BOCES / community college / on the job / military)
- Routes to different question flows based on answer
- Employer has separate 3-step setup: company profile → hiring needs → how to hire

### Certification Matching
- Green boxes = student has cert
- Gray boxes = student missing cert
- Tap gray box → DM an instructor

### AI Job Description Transformation
- Employer pastes raw job description
- Claude API rewrites it into student-friendly language
- Mentions cert sponsorship if employer offers it

### Admin Panel
- Password protected (`homegrown2026`)
- Add real jobs that appear dynamically in student feed

---

## Platform Framing
- "Local" not "Student" — open to BOCES grads, CC students, veterans, career changers
- Workers = "locals"
- Employers are local businesses, not national corps

---

## Password Requirements (auth)
- Minimum 8 characters
- At least 1 number
- At least 1 special character (!@#$%^&*)
- NOT case sensitive (no uppercase requirement)
- Confirm password field required
- Inline real-time validation

---

## Key Contacts (for context, not to contact)
- **Sonnet Constable** — DCMO BOCES Work-Based Learning Coordinator (27 yrs experience)
- **Matt Butler** — DCMO BOCES College & Career Counselor
- **Raymond's Corporation** — Greene, NY forklift manufacturer (Toyota-owned), 50-100 open roles

---

## Current Priorities
1. Password validation fix (both signup flows)
2. Real employer job posting flow (write to Supabase `jobs` table, not demo UI)
3. Employer dashboard showing their own posted jobs
4. Outreach to Applications Day employers for real job listings

---

## What NOT to change without asking
- Color scheme
- Font (Plus Jakarta Sans)
- Supabase table names/column names
- Admin panel password
- The "local" framing (not "student")

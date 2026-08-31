# Security review & hardening — 2026-08-27

Full pass over the Global Pathway CRM (React + Vite frontend, Supabase Postgres +
Auth + Edge Functions, eSewa/Khalti payments). This file records **every issue
found**, **what was changed in code**, and **what you still have to do** (deploy +
database + dashboard settings — those can't be done from the repo).

---

## TL;DR — do these now

1. **Check for rogue accounts.** `create-staff-user` was a public endpoint that
   accepted a caller-supplied role. Run query 5 & 6 in
   `supabase sql code/security-audit-queries.sql` and confirm every `admin` row
   is someone you know. Delete any you don't recognise.
2. **Deploy the 6 edge functions** (they were rewritten):
   `supabase functions deploy create-staff-user delete-user khalti-verify verify-esewa-payment khalti-initiate esewa-sign`
3. **Set edge-function secrets** (Dashboard → Edge Functions → Secrets):
   - `ALLOWED_ORIGINS=https://your-domain,https://www.your-domain`
   - **Delete** `ALLOW_PAYMENT_SIMULATION` if it exists (or never set it).
4. **Apply RLS.** Review `supabase sql code/security-rls-policies.sql` against
   your real schema, then run it. Run `security-audit-queries.sql` before & after.
5. **Redeploy the frontend** so `public/_headers` / `vercel.json` take effect.
6. **Tighten Supabase Auth settings** (see §7).

---

## Findings

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | 🔴 Critical | `create-staff-user` edge function was public (`verify_jwt=false`, no auth check) and trusted a caller-supplied `role` → **anyone on the internet could create themselves an admin account** | Fixed in code — needs deploy |
| 2 | 🔴 Critical | `delete-user` edge function was public with no auth check → **anyone could delete any/every user** (profile + auth row) | Fixed in code — needs deploy |
| 3 | 🔴 Critical | Unknown/again inconsistent **Row Level Security**. Frontend reads `payments`, `profiles`, `staff`, `applicants`, `messages` across all rows; CHANGES.md shows policies are partial/missing. With the public anon key, any logged-in student could read/modify everything if RLS is off | SQL written (`security-rls-policies.sql`) — **you must review + run it** |
| 4 | 🔴 Critical | Privilege escalation: if RLS lets a user update their own `profiles` row (needed for name/phone in Settings), nothing stopped `update profiles set role='admin' where id = me` | Fixed by trigger in `security-rls-policies.sql` — needs run |
| 5 | 🟠 High | `khalti-verify` `simulate:true` branch was public → mark any payment `pending_verification` with **no money paid**. The "⚡ Simulate Successful Payment" button also shipped in the production bundle | Fixed: server gate `ALLOW_PAYMENT_SIMULATION`, client button hidden unless `import.meta.env.DEV` |
| 6 | 🟠 High | Payment verify functions trusted a client-supplied `payment_id` with **no link between the confirmed transaction and the invoice** and no amount check → a cheap real payment could be replayed to clear an expensive invoice | Fixed: `verify-esewa-payment` & `khalti-verify` now load the `payments` row and require the gateway-confirmed amount to match; never overwrite a `paid` row |
| 7 | 🟠 High | `esewa-sign` was a public **HMAC signing oracle** — it would sign any `(amount, uuid)` pair for anyone | Fixed: requires a session, verifies the payment row belongs to the caller and the amount matches before signing |
| 8 | 🟠 High | `khalti-initiate` trusted the client `amount` (in paisa) → student could start a Rs 1 charge against a Rs 50,000 fee | Fixed: amount is now taken from the `payments` row, client value ignored; caller must own the row |
| 9 | 🟡 Medium | All 6 edge functions used `Access-Control-Allow-Origin: *` | Fixed: origin is echoed only if it's in `ALLOWED_ORIGINS` (falls back to `*` until you set the secret, so nothing breaks meanwhile) |
| 10 | 🟡 Medium | No security response headers (no CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`) → clickjacking, MIME sniffing, no transport pinning | Added `public/_headers` (Netlify) and `vercel.json` (Vercel). Replicate on your host if it's neither |
| 11 | 🟡 Medium | `emailService.js` emails the student's **plaintext password**, and `Staff.jsx` shows it in an `alert()`. EmailJS `SERVICE_ID`/`PUBLIC_KEY` are hardcoded | Not code-fixed (needs a flow change). See §5 — switch to Supabase invite / forced reset, and lock EmailJS allowed origins |
| 12 | 🟡 Medium | `verify_jwt = false` on functions that don't need to be open | Fixed in `supabase/config.toml`: `create-staff-user`, `delete-user`, `esewa-sign`, `khalti-initiate` now require a JWT at the gateway. The two gateway-redirect functions stay open but self-check the amount |
| 13 | 🟢 Low | `.env` / secrets hygiene: `.gitignore` only covered a few `.env.*` names; `.env.example` had a real anon key; `supabase/.temp` tracked | Fixed: broadened `.gitignore`, rewrote `.env.example` with placeholders |
| 14 | 🟢 Low | Supabase client created with default options (implicit flow) | Set `flowType: 'pkce'` + explicit auth options in `src/supabase.js`; also throws a visible console error if env vars are missing |
| 15 | 🟢 Low | `login.jsx` password reset uses `prompt()`/`alert()`; reset redirect goes to `window.location.origin` | Left as-is (works). Lock the allowed redirect URLs in Supabase Auth (§7) so the reset link can't be pointed elsewhere |
| 16 | ℹ️ Info | No `dangerouslySetInnerHTML` / `eval` / `innerHTML` anywhere in `src/` — DOM-XSS surface is low. `localStorage` holds a cached `profile`; `ProtectedRoute` re-verifies against the server so it's a cache, not the authority | No change needed |

---

## What changed in the repo

### Edge functions (`supabase/functions/`) — **all need redeploy**
- **`create-staff-user/index.ts`** — requires `Authorization: Bearer <jwt>`; resolves
  caller role from `profiles`; only admin/staff/receptionist may create a `student`,
  only admin may create staff roles; `role` validated against an allow-list; min
  password length 8; rolls back the orphaned auth user if the profile insert fails;
  origin-restricted CORS.
- **`delete-user/index.ts`** — requires JWT; caller must be admin/staff/receptionist;
  can't delete yourself; only an admin can delete an admin; origin-restricted CORS.
- **`khalti-verify/index.ts`** — `simulate` disabled unless `ALLOW_PAYMENT_SIMULATION="true"`;
  real path loads the `payments` row, refuses if already `paid`, requires the
  Khalti-confirmed amount to match the invoice; origin-restricted CORS.
- **`verify-esewa-payment/index.ts`** — loads the `payments` row, refuses if already
  `paid`, requires the eSewa-confirmed amount to match; origin-restricted CORS.
- **`khalti-initiate/index.ts`** — requires JWT; amount comes from the DB row, not the
  client; caller must own the row (`student_email`); origin-restricted CORS.
- **`esewa-sign/index.ts`** — requires JWT; parses `payment_id` out of the
  `GP-<id>-<suffix>` uuid, checks ownership + unpaid + amount match before signing;
  origin-restricted CORS.
- **`config.toml`** — `verify_jwt` flipped to `true` for the four that should never be
  anonymous; explicit entries added for `khalti-initiate` / `khalti-verify`.

### Frontend
- **`src/supabase.js`** — `flowType: 'pkce'`, explicit auth opts, missing-env guard,
  and a new `functionHeaders()` helper that attaches the caller's access token.
- **`src/pages/Staff.jsx`**, **`src/pages/Applications.jsx`**,
  **`src/pages/student/StudentPayments.jsx`**,
  **`src/pages/payment/EsewaSuccess.jsx`**, **`src/pages/payment/KhaltiSuccess.jsx`**
  — every `fetch(.../functions/v1/...)` now sends `await functionHeaders()`.
- **`src/pages/payment/KhaltiSuccess.jsx`** — the "Simulate Successful Payment"
  panel and handler are gated behind `import.meta.env.DEV`; it is not in a
  production build at all.
- **`index.html`** — added `referrer` meta; real headers moved to host config.

### New files
- **`public/_headers`**, **`vercel.json`** — CSP, HSTS, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`,
  `Cross-Origin-Opener-Policy`.
- **`supabase sql code/security-rls-policies.sql`** — full RLS baseline + role-change
  trigger + storage lockdown. **Template — review column names against your schema.**
- **`supabase sql code/security-audit-queries.sql`** — read-only checks to run before
  and after.
- **`.env.example`** — placeholders only.

### Build
`npx vite build` → 0 errors (unchanged 774 kB chunk-size advisory only).

---

## What you must do (not doable from the repo)

### 1. Redeploy edge functions
```
supabase functions deploy create-staff-user delete-user khalti-verify \
  verify-esewa-payment khalti-initiate esewa-sign
```
Until this runs, the **old public versions are still live**.

### 2. Edge-function secrets (Dashboard → Edge Functions → Secrets)
| Secret | Value |
|--------|-------|
| `ALLOWED_ORIGINS` | `https://<your-domain>,https://www.<your-domain>` (and your Vercel/Netlify preview domain if you test there) |
| `ALLOW_PAYMENT_SIMULATION` | **must not exist** in production. Delete it. Set to `true` only on a throwaway/staging project |
| `SITE_URL` | your real site origin, e.g. `https://gpcrm.app` |
Confirm `SUPABASE_SERVICE_ROLE_KEY`, `KHALTI_SECRET_KEY`, `ESEWA_SECRET_KEY`,
`ESEWA_MERCHANT_CODE` are set. The service-role key was never in client code — no
rotation needed unless it leaked elsewhere.

### 3. Database — RLS
1. Run `security-audit-queries.sql` and screenshot the "RLS off" list (query 1).
2. Open `security-rls-policies.sql`, diff every table/column name against your
   schema (especially `payments.student_email`, `tasks.related_to`,
   `messages.sender_email`/`receiver_email`, `appointments.*`,
   `documents.applicant_id`). Fix names to match.
3. Run it section by section in the SQL editor.
4. Smoke-test as a student login and as each staff role — you're looking for
   "row not found"/empty lists where the user *should* see data (policy too
   tight) and, more importantly, data they *shouldn't* see (policy too loose).
5. Re-run `security-audit-queries.sql` — query 1 should show `rls_enabled = true`
   for every table.
6. If `student-docs` storage bucket is public, decide: keep public (URLs are
   guessable-ish) or flip to private + switch the app to `createSignedUrl()`.

### 4. Check for damage from the open endpoints
- `security-audit-queries.sql` query 5 & 6 — unknown roles / unexpected admin
  count.
- Supabase Dashboard → Authentication → Users — sort by created date, look for
  sign-ups you didn't make.
- `payments` query 7 — rows in `paid`/`pending_verification` with no `txn_ref`.

### 5. Stop emailing plaintext passwords (finding 11)
Current flow: admin types a password → account created → password emailed via
EmailJS in cleartext → also shown in an `alert()`.
Recommended:
- Use `supabase.auth.admin.inviteUserByEmail()` (from the edge function) or
  generate a random password server-side and immediately call
  `resetPasswordForEmail` / set a "must change password" flag.
- Never put the password in the email body or an `alert`.
- In the EmailJS dashboard, set **Allowed Origins** to your domain so the
  hardcoded public key can't be used from anywhere else. Move `SERVICE_ID` /
  `PUBLIC_KEY` to `VITE_` env vars.

### 6. Hosting headers
`public/_headers` covers Netlify, `vercel.json` covers Vercel. On any other host
(nginx, Cloudflare Pages, S3+CloudFront) copy the same header set into that
platform's config. Verify after deploy with
`curl -I https://<your-domain>` — you should see `content-security-policy`,
`strict-transport-security`, `x-frame-options`.

### 7. Supabase Auth settings (Dashboard → Authentication → Providers / Policies / URL config)
- **Confirm email**: ON.
- **Minimum password length**: 8+ (matches the new edge-function check). Enable
  "Prevent use of leaked passwords".
- **Site URL** + **Redirect URLs**: list only your real domains. This is what
  stops the `resetPasswordForEmail(..., { redirectTo: window.location.origin })`
  call from being abused via a spoofed origin.
- **JWT expiry**: default 3600s is fine; lower if you want.
- Consider enabling **CAPTCHA** on auth endpoints (bot sign-up / brute force).
- Turn on **rate limiting** for the Auth API if your plan exposes it.

---

## Residual risk / out of scope

- The two gateway-redirect functions (`verify-esewa-payment`, `khalti-verify`)
  remain reachable without a JWT because the redirect back from eSewa/Khalti
  isn't guaranteed to carry the session. They're now safe against *amount*
  abuse, but a determined attacker who has made one real payment could still
  call them with their own `pidx`/`transaction_uuid`. That only ever confirms
  *their own* correctly-paid invoice, which is the intended behaviour. If you
  want them locked down too, add an idempotency/nonce table keyed on
  `txn_ref` and reject reused refs.
- Client-side route guards (`ProtectedRoute`) are UX only. Real enforcement is
  RLS (finding 3) — don't skip step 3.
- Bundle size / dependency CVE audit (`npm audit`) not part of this pass.
- No automated tests were added; there is no test setup in the repo.

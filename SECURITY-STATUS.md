# Security status — what's done, what's left

Quick-reference checklist. Full detail & reasoning: `SECURITY.md`.
Last updated: 2026-08-27.

Legend: ✅ done in code (this branch) · 🚀 in repo, takes effect on next deploy · 🟦 needs you (dashboard / DB / CLI) · ⬜ not started / decision needed

---

## PART 1 — Implemented (code is written, build passes)

### Edge Functions — authentication & authorization
| ✅ | `create-staff-user` now requires a valid login token, checks the caller's role server-side, and only lets admins create staff accounts (admin/staff/receptionist can create students). `role` is validated against an allow-list. Was: **public, anyone could create an admin**. |
| ✅ | `delete-user` now requires a login token; caller must be admin/staff/receptionist; can't delete your own account; only an admin can delete an admin. Was: **public, anyone could delete any user**. |
| ✅ | `khalti-initiate` requires a login token; the charge amount is read from the database row, not the browser; caller must own the payment. Was: browser could set any amount. |
| ✅ | `esewa-sign` requires a login token; verifies the payment belongs to the caller and the amount matches before signing. Was: **public HMAC signing oracle** — signed any amount for anyone. |
| ✅ | `khalti-verify` / `verify-esewa-payment` now load the invoice row, refuse to touch an already-paid row, and require the payment-gateway-confirmed amount to equal the invoice amount. Was: a cheap real payment could clear an expensive invoice. |
| ✅ | `khalti-verify` "simulate payment" (mark paid with no money) is disabled unless the `ALLOW_PAYMENT_SIMULATION` server secret is exactly `"true"`. |
| ✅ | All 6 functions: CORS restricted to an `ALLOWED_ORIGINS` allow-list (falls back to open until you set the secret, so nothing breaks in between). |
| ✅ | `supabase/config.toml`: `verify_jwt = true` for `create-staff-user`, `delete-user`, `esewa-sign`, `khalti-initiate` (gateway rejects tokenless calls before the function even runs). |

### Frontend
| ✅ | `src/supabase.js`: PKCE auth flow, explicit session options, loud error if env vars missing, new `functionHeaders()` helper that attaches the caller's token. |
| ✅ | Every call to an edge function (`Staff.jsx`, `Applications.jsx`, `StudentPayments.jsx`, `EsewaSuccess.jsx`, `KhaltiSuccess.jsx`) now sends the login token. |
| ✅ | "⚡ Simulate Successful Payment" button (`KhaltiSuccess.jsx`) is compiled out of production builds (`import.meta.env.DEV` only). |
| ✅ | `index.html`: `Referrer-Policy` hint added. |

### Response headers (🚀 files are in the repo, take effect on next deploy)
| 🚀 | `public/_headers` (Netlify/Cloudflare) + `vercel.json` (Vercel) ship: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`. Protects against clickjacking, MIME sniffing, mixed content. |

### Repo hygiene
| ✅ | `.gitignore` broadened: all `.env.*` (except `.env.example`), `supabase/.env`, `supabase/.temp/`, `*.pem`, `*.key`. |
| ✅ | `.env.example` rewritten with placeholders only (was committed with a real key). |

### Database (SQL written — 🟦 you must review & run it)
| 🟦 | `supabase sql code/security-rls-policies.sql` — Row Level Security for every table (`profiles`, `payments`, `applicants`, `staff`, `tasks`, `appointments`, `visitors`, `messages`, `documents`) + storage buckets. Students see only their own rows; staff see CRM data. **Template — column names must be checked against your schema before running.** |
| 🟦 | Same file: a trigger that blocks anyone except an admin from changing a `profiles.role` (stops a user promoting themselves to admin). |
| 🟦 | `supabase sql code/security-audit-queries.sql` — read-only checks to run before & after. |

---

## PART 2 — Left to do (cannot be done from the repo)

### Must do — the fixes above are NOT live until these happen
| 🟦 | **Deploy the 6 edge functions** — `supabase functions deploy <name>` for each. Until then the **old public versions are still serving traffic**. |
| 🟦 | **Deploy the frontend** so the token-sending code + header files go live. Do this *before* deploying the functions. |
| 🟦 | **Set `ALLOWED_ORIGINS`** secret; **delete `ALLOW_PAYMENT_SIMULATION`** on the production project; confirm `SITE_URL` is your real domain. |
| 🟦 | **Review + run `security-rls-policies.sql`** section by section, fixing any column names that don't match your schema. Then smoke-test as a student and as each staff role. |
| 🟦 | **Check for abuse of the old open endpoints:** run audit queries 5–7; check Authentication → Users for sign-ups you didn't make; delete any rogue admin rows. |

### Should do — real weaknesses, but not one-command fixes
| ⬜ | **Stop emailing plaintext passwords.** `src/emailService.js` + `Applications.jsx` email the student's password in cleartext and `Staff.jsx` shows it in a popup. Switch to `inviteUserByEmail()` or a random password + forced reset. Never put the password in the email or an alert. |
| ⬜ | **Lock EmailJS.** In the EmailJS dashboard set *Allowed Origins* to your domain (the public key is in the bundle; without this anyone can send mail through your templates/quota). Move `SERVICE_ID`/`PUBLIC_KEY` to `VITE_` env vars. |
| ⬜ | **Supabase Auth settings:** turn on *Confirm email*; set minimum password length to 8; enable *leaked password protection*; restrict *Redirect URLs* to your domains only (protects the password-reset link). |
| ⬜ | **`student-docs` storage bucket:** if it's public, decide whether to keep it public or make it private + switch the app to `createSignedUrl()`. |
| ⬜ | **Verify headers after deploy:** `curl -I https://your-domain` should show `content-security-policy`, `strict-transport-security`, `x-frame-options`. If your host isn't Vercel/Netlify, copy the header set into that host's config. |

### Nice to have — defense in depth, lower urgency
| ⬜ | Add an idempotency/nonce table on `payments.txn_ref` so a gateway verification can't be replayed even for the same amount. |
| ⬜ | Enable CAPTCHA + Auth rate limiting in Supabase (bot sign-up / brute force). |
| ⬜ | `npm audit` — dependency vulnerability review (not covered in this pass). |
| ⬜ | Add automated tests (no test setup exists in the repo today). |
| ⬜ | Code-split the 774 kB bundle (perf, not security — noted by the build). |

---

## One-line summary

**Done:** every edge function is now authenticated and authorization-checked, payments can't be forged or under-paid, security headers and RLS policies are written, repo secrets tidied.
**Left:** deploy it all, run the RLS SQL, tighten Supabase Auth settings, and replace the plaintext-password email flow.

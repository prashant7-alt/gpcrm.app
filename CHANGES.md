# Changes — 2026-08-26

## Summary

Reviewed the uncommitted working-tree changes to `src/pages/Reports.jsx` and `src/pages/Staff.jsx`.

- Ran `vite build` — completed with **0 errors** (only the usual "chunk larger than 500kB" advisory, unrelated to these files).
- Checked editor/IDE diagnostics — **0 issues**.
- Reviewed both files for logic bugs (unused imports, dangling references, mismatched styles) — none found. `lucide-react` is already listed in `package.json`, and every newly imported icon (`Mail`, `Phone`, `Calendar`, `Trash2`, `Search`) is used.

**No errors were found**, so no code fixes were needed. Below is a record of what the existing uncommitted diff changes, for reference.

## `src/pages/Staff.jsx`

- Replaced emoji glyphs with `lucide-react` icon components for a more consistent, scalable UI:
  - 🔍 → `<Search>` in the search box and the "no results" empty state
  - 📧 → `<Mail>`, 📱 → `<Phone>`, 📅 → `<Calendar>` on each staff card
  - 🗑️ → `<Trash2>` on the "Remove" button
- Removed the solid color bar (`height: 5, background: avatarColor(...)`) from the top of each staff card.
- Tightened the gap between contact-info rows on each card (6px → 8px) and wrapped the phone/joined text in `<span>` for consistent layout.
- Simplified a comment above the staff card grid.

## `src/pages/Reports.jsx`

- Removed the colored top border (`borderTop: 3px solid ${card.border}`) from each summary stat card. The `card.border` color is still used to tint the stat's icon, so nothing is now unused/dead.

## `src/pages/Documents.jsx` (admin Documents page)

Replaced every emoji with a `lucide-react` icon, matching the `Staff.jsx` conversion:

- 📎 → `<Paperclip>` on "View file" links
- 🗑️ → `<Trash2>` on "Delete" (file link) buttons
- 👤 → `<User>` on the "Per Student" tab
- 📋 → `<ClipboardList>` on the "All Documents" tab, and on "Not set up" / "Missing" doc rows
- 📁 / 📂 → `<FolderOpen>` on the "select a student" and "no documents found" empty states
- ✅ / 📄 / 📋 (status glyph shown per document row) → a new `DocStatusIcon` helper rendering `<CheckCircle2>` (Verified) / `<FileText>` (Received) / `<ClipboardList>` (Missing), used in 4 places (mobile + desktop, per-student + all-documents views)
- ✏️ → `<Pencil>` on all 4 "Edit" buttons
- 🔍 → `<Search>` on the all-documents search box
- ℹ️ → `<Info>` on the "add student" modal's helper note

Left unchanged (consistent with `Staff.jsx`): the plain `✕` modal-close glyphs, the `✓` "file selected" checkmark, and the `●` bullet in front of each doc type in the add-student preview — these are plain symbols, not icon-replaceable emoji, and match how `Staff.jsx` treated the same cases.

Verified with `vite build` after the change — 0 errors.

## Status badges — "Missing" red pill redesign (admin `Documents.jsx` + student `StudentDocuments.jsx`)

The flat solid-red "Missing" status pill looked harsh, so all status badges (Verified / Received-Uploaded / Missing) were redesigned consistently across both pages:

- Softer fill colors (e.g. red `#fee2e2` → `#fef2f2`) with a matching 1px border for definition instead of a flat color block
- Added a small colored dot before the label for quicker scanning
- Extracted into a reusable `StatusBadge` component in `Documents.jsx` and applied the same `bg`/`border`/`color`/`dot` shape to `STATUS_COLOR` + `Chip` in `StudentDocuments.jsx`
- Applied to: the per-student summary count chips, every per-document-row status badge (mobile + desktop, both views) in `Documents.jsx`, and the student portal's per-document badge + top summary chips in `StudentDocuments.jsx`

Verified with `vite build` — 0 errors.

## Status badges — made more compact

Follow-up on the badge redesign above — the pills were too wide/long, so tightened them up in both `Documents.jsx` and `StudentDocuments.jsx`:

- Smaller padding, smaller dot (6px → 5px), tighter gap, slightly smaller font (11px → 10.5px)
- Per-document-row badges now use a fixed `minWidth` so "Verified" and "Missing" render the same pill size instead of the width jumping around per label length
- Double-checked the color mapping: Verified = green, Received/Uploaded = blue, Missing = red, consistent between the two files

Verified with `vite build` — 0 errors.

## New feature — Staff Profile popup (view/edit, self-service profile picture)

Added a real staff profile section, built as a shared popup component so both admin and staff use the same UI:

**New files**
- `src/components/StaffProfileModal.jsx` — the popup itself: photo (upload/remove), name, email (read-only), role, phone, and joining date. Also exports `getStaffAvatar`, `getInitials`, `avatarColor` for reuse.
- `src/lib/staffRoles.js` — the `ROLES` list, moved out of `Staff.jsx` so both the Staff page and the modal's role dropdown share one source of truth.

**`src/pages/Staff.jsx`** (admin side)
- Each staff card now shows the person's photo (if set) and has a **"View Profile"** button (also click the avatar/name area) that opens the popup for that staff member.
- Admin can edit name, role label, phone, and joining date there — saved to the `staff` table (`saveStaffProfile`). A note under the role dropdown clarifies it only changes the display label, not actual page access (that's set when the login is created).

**`src/components/Navbar/Navbar.jsx`** (self-service, all staff roles)
- Clicking your own avatar (top-right, works for every role now, not just admin) opens **"My Profile"** — the same popup, showing your own info. Role is read-only here (role changes stay admin-only).
- Saving updates the `profiles` table (name + phone — same fields `Settings.jsx` already edits) and, if you also have a `staff` table row, keeps its name/phone in sync too. The navbar name/avatar update immediately without a page reload.
- Previously the avatar only did anything for admins (jumped to `/settings`); Settings is still reachable from the sidebar for admins, the avatar is now the profile shortcut for everyone.

**Profile picture — client-side only, as requested**
- Photos are stored as data URLs in `localStorage`, keyed by the person's email (`staffAvatar:<email>`) — no Supabase Storage bucket involved.
- Caveat (shown in the popup itself): this means a photo only shows up on the browser/device it was uploaded from. If an admin sets a photo for someone on the admin's laptop, that staff member won't see it on their own device — there's no server sync yet. Making it real (persisted, synced) would need a Supabase Storage bucket + a `avatar_url` column, which was intentionally skipped per your "no need to store in Supabase for now" instruction.
- Capped uploads at 1.5MB to keep `localStorage` usage sane.

Verified with `vite build` — 0 errors.

## Profile pictures now use real Supabase Storage (no more localStorage)

Follow-up to the staff profile popup above — photos are now actually persisted in Supabase instead of the browser, so they show up for everyone, on any device.

**⚠️ One-time setup required before this works — run `supabase sql code/avatars-setup.sql`**
Open your Supabase project → SQL Editor → paste the contents of `supabase sql code/avatars-setup.sql` in this repo → Run. It:
1. Creates a public `avatars` storage bucket (same public-read pattern already used by the existing `student-docs` bucket).
2. Adds storage policies: anyone can view a photo, only logged-in users can upload/replace/delete one.
3. Adds an `avatar_url text` column to both the `profiles` table and the `staff` table.

Until you run that SQL, uploading a photo will fail with a clear error message inside the popup (e.g. "Bucket not found") rather than crashing — nothing else in the app is affected.

**Code changes**
- `src/components/StaffProfileModal.jsx` — photo upload now calls `supabase.storage.from('avatars').upload(...)`, gets the public URL, and hands it to a new `onPhotoChange(url)` prop for the caller to persist (instead of writing to `localStorage`). Removing a photo deletes the old file from storage too. Upload cap raised from 1.5MB to 3MB now that it's real storage, not `localStorage`. Added an uploading spinner over the avatar while the request is in flight.
- `src/pages/Staff.jsx` — staff cards now read the photo straight from `s.avatar_url` (the `staff` table row); `onPhotoChange` persists via `supabase.from('staff').update({ avatar_url })`.
- `src/components/Navbar/Navbar.jsx` — "My Profile" avatar reads `profile.avatar_url` (falling back to the matching `staff` row's); `onPhotoChange` persists to `profiles.avatar_url` and, if a matching `staff` row exists, keeps it in sync there too — mirroring how name/phone already sync between the two.

Verified with `vite build` — 0 errors. (Can't verify the live upload/RLS path myself — I don't have your Supabase credentials — so please test one upload after running the SQL and let me know if the storage policies need adjusting for your project.)

## Fix — photo changed via "My Profile" (staff) didn't show on the admin Staff page

**Likely cause:** the `staff` table is normally admin-managed, so its RLS policies probably only let `admin` write to it. When a staff member updates their own avatar from the navbar's "My Profile" popup, the app tries to write the new URL to both `profiles.avatar_url` (always allowed — it's their own row) and `staff.avatar_url` (their row, but a different table). If `staff` doesn't have a policy allowing that, the write to `staff` silently affects 0 rows — no error is thrown, it just doesn't apply — while `profiles` updates fine. The admin Staff page was only reading `staff.avatar_url`, so it never saw the change. (A simpler, unrelated possibility worth ruling out too: the admin's Staff page has no live-refresh, so if that tab was already open before the photo was uploaded, a manual reload would also fix it.)

**Fix shipped — `src/pages/Staff.jsx`:** `load()` now also fetches `profiles.avatar_url` for everyone and uses it as a fallback whenever a staff row's own `avatar_url` is empty. So the photo shows up on the admin page either way, regardless of whether the `staff`-table sync succeeded.

**Optional DB fix — `supabase sql code/staff-self-update-policy.sql`:** adds an RLS policy letting a logged-in user update only their *own* `staff` row (matched by email). Run this if you also want name/phone edited from "My Profile" to land in the `staff` table itself (not just fall back for the photo) — same root cause, just not user-visible yet since you hadn't tested that path.

Also added a console warning (`Navbar.jsx`) when the `staff` sync silently no-ops, so this is easier to spot next time instead of guessing.

Verified with `vite build` — 0 errors. Please re-test: upload a photo as a staff (non-admin) user, then check the Staff page as admin — it should show now without needing the optional SQL.

## Fix — admin-side changes didn't show up on the staff member's own "My Profile"

Same root cause as the previous fix, mirrored: the `staff` table is admin-only, so a non-admin staff member's browser generally can't even *read* another row (or their own row) from it — only admins can. "My Profile" falls back to the `staff` table for phone/joined-date/photo (`myStaffRow`), but if that lookup itself is blocked, there's nothing to fall back to, and the person never sees changes an admin made from the Staff page.

**Fix — `src/pages/Staff.jsx`:** when an admin edits a staff member's name/phone/photo, the save now also best-effort writes the same change into that person's `profiles` row (matched by email) — `name`/`phone_new` from `saveStaffProfile`, `avatar_url` from `saveStaffAvatar`. That's the row the staff member reliably reads for themselves (confirmed by other pages in this app — `Applications.jsx`, `Payments.jsx` — already reading/writing across all `profiles` rows, not just the logged-in user's own). Role is intentionally **not** synced this way — `staff.role` is just the card's display label, while `profiles.role` controls actual page access and should only change when a login is created.

This is a one-way mirror of the earlier staff→admin fix: staff-made edits fall back through `profiles` when read on the admin page; admin-made edits now get written into `profiles` directly so they show up for the staff member. Between the two, both directions work without needing the optional RLS policy — though running `staff-self-update-policy.sql` still makes the `staff` table itself fully consistent too, if you want that.

One caveat that's not fixable without real-time subscriptions (out of scope here): if the staff member already has "My Profile" open in a tab when the admin makes the change, they won't see it until they reopen the popup or reload the page — same as the admin side needing a refresh.

Verified with `vite build` — 0 errors.

## Cleanup — unused/junk files moved to `supabase sql code/waste file/`

You asked me to check every file in the project for waste/junk and move (not delete) anything with no real use. I checked every tracked file for actual usage (grepped every `src` file for references, checked what's imported from `App.jsx`/`main.jsx`/each other, and diffed the build output before/after) and moved these — nothing else in the project referenced any of them, and the production build is byte-for-byte identical before and after the move, confirming none of it did anything:

| File | Why it's junk |
|---|---|
| `GlobalPathway_Database.sql` | Empty (0 bytes) since it was added |
| `gpcrm.app.sql` | Empty (0 bytes) since it was added |
| `staff_backup.txt` | An old plain-text dump of an earlier `Staff.jsx` — not code, not imported, just a stray backup |
| `src/App.css` | Empty, and never `import`ed anywhere |
| `src/components/Navbar/Navbar.css` | Empty, and never `import`ed anywhere |
| `src/components/Sidebar/Sidebar.jsx` | A full 223-line old sidebar — superseded by the sidebar now built into `Navbar.jsx`; zero references anywhere |
| `src/components/StudentSidebar/StudentSidebar.jsx` | Empty (0 bytes) AND never referenced |
| `src/statusEngine.js` | A complete 102-line pipeline-status module, exported but never imported by anything — looks superseded by `src/lib/pipelineStages.js`, which is what's actually used |
| `public/icons.svg` | Never referenced in `index.html` or anywhere in `src/` |
| `public/favicon.svg` | Never referenced via a `<link rel="icon">` tag — `index.html` has no favicon link at all. Small caveat: some browsers auto-probe `/favicon.svg` at the site root by convention even without a `<link>` tag, so if your tab icon changes, that's why — easy to move back if so |

The empty `src/components/Sidebar/` and `src/components/StudentSidebar/` folders were removed since they had nothing left in them after the move.

**Not touched, flagged instead:**
- `supabase/.temp/*` (gotrue-version, linked-project.json, pooler-url, etc.) — this is the Supabase CLI's own local cache/link state, not junk from the app itself. Regenerated automatically by the CLI, so moving it wouldn't break anything, but it also wouldn't help — recommend just adding `supabase/.temp/` to `.gitignore` instead if you don't want it tracked.
- `.env.example` — unrelated finding, not junk: it's tracked in git but **currently missing from disk** (shows as deleted in `git status`). Worth knowing it also contained the real (public-safe) anon key rather than a placeholder, in case that's something you'd rather redo when restoring it. I left it alone since deleting/restoring it wasn't part of what you asked — let me know if you want it back (`git checkout -- .env.example`).

Verified with `vite build` (identical output hash) and a dev-server smoke test — 0 errors either way.

## Recommendation

These look like an intentional, in-progress visual cleanup (swapping emoji for proper icons, removing colored accent bars). Since they're not yet committed, let me know if you'd like them committed as-is, or if there's a specific error/bug you were seeing that I should chase down further (e.g., something you saw at runtime rather than at build time).

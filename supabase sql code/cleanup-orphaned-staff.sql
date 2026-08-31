-- ============================================================================
-- One-off cleanup: remove "ghost" staff left behind by the old Staff-page
-- delete flow, which only deleted the `staff` table row and left the
-- `profiles` row + auth login intact.
--
-- A ghost = a `profiles` row that is NOT a student and has NO matching row in
-- the `staff` table (matched by email, case-insensitive). These are the rows
-- that keep a removed staff member showing up in the student chat and still
-- able to log in.
--
-- Admin / superadmin accounts are intentionally SPARED — they can legitimately
-- exist without a `staff` row (seeded directly). Remove those two names from
-- the NOT IN (...) list below if you want them cleaned too.
--
-- Run in the Supabase SQL editor. ALWAYS run STEP 1 and eyeball the list
-- before running STEP 2 / STEP 3.
-- ============================================================================


-- ── STEP 1 — PREVIEW: exactly what the delete steps will target ─────────────
select p.id, p.name, p.email, p.role, p.created_at
from public.profiles p
where lower(coalesce(p.role, '')) not in ('student', 'admin', 'superadmin')
  and not exists (
    select 1 from public.staff s
    where lower(trim(s.email)) = lower(trim(coalesce(p.email, '')))
  )
order by p.created_at;


-- ── STEP 2 — delete their auth logins ──────────────────────────────────────
-- If profiles.id references auth.users(id) ON DELETE CASCADE (the Supabase
-- default when the FK was created that way), this also removes the profiles
-- rows. STEP 3 is the safety net for when it does not.
delete from auth.users u
where u.id in (
  select p.id
  from public.profiles p
  where lower(coalesce(p.role, '')) not in ('student', 'admin', 'superadmin')
    and not exists (
      select 1 from public.staff s
      where lower(trim(s.email)) = lower(trim(coalesce(p.email, '')))
    )
);


-- ── STEP 3 — safety net: drop any profiles rows that survived STEP 2 ────────
delete from public.profiles p
where lower(coalesce(p.role, '')) not in ('student', 'admin', 'superadmin')
  and not exists (
    select 1 from public.staff s
    where lower(trim(s.email)) = lower(trim(coalesce(p.email, '')))
  );


-- ── STEP 4 (optional) — verify nothing is left ─────────────────────────────
select count(*) as remaining_ghost_profiles
from public.profiles p
where lower(coalesce(p.role, '')) not in ('student', 'admin', 'superadmin')
  and not exists (
    select 1 from public.staff s
    where lower(trim(s.email)) = lower(trim(coalesce(p.email, '')))
  );

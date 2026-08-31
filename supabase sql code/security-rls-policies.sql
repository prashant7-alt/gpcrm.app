-- ============================================================================
-- security-rls-policies.sql   —   Row Level Security for GPCRM
-- ----------------------------------------------------------------------------
-- REBUILT 2026-08-31 from the frontend query surface (the schema-reviewed
-- original was lost — never committed). TREAT AS A TEMPLATE: verify every
-- column name against the live schema before running. Run section by section
-- in the Supabase SQL editor; if a section errors, fix the column name and
-- re-run just that section. A full rollback block is at the bottom.
--
-- Data model as inferred from the app (CONFIRM THESE):
--   profiles(id uuid PK = auth.users.id, email text, name, phone, phone_new,
--            role text, applicant_id uuid -> applicants.id, avatar_url)
--   applicants(id uuid PK, name, email, phone, course, country, status, created_at)
--   staff(id uuid PK, name, role, email, phone, phone_new, joined, avatar_url)
--   payments(id, student_name text, amount, method, status, date, ...)   <- linked by NAME (fragile)
--   student_documents(id, email text, ...)                               <- linked by EMAIL
--   appointments(id, ...), messages(id, ...), tasks(id, ...), visitors(id, ...)
--   visa_rates(country text PK, rate numeric)
--   students(...)  <- legacy/unused? confirm before enabling
--
-- Roles considered "staff": admin, staff, finance_officer, document_handler,
-- receptionist, counselor, visa_officer   (mirrors create-staff-user STAFF_ROLES)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0.  Helper: is_staff()  — true when the current user's profile role is staff
-- ---------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','staff','finance_officer','document_handler',
                     'receptionist','counselor','visa_officer')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

revoke all on function public.is_staff()  from public;
revoke all on function public.is_admin()  from public;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 1.  profiles
--     - a user can read/update their OWN row
--     - staff can read every row (Applications/Payments/Staff pages do this)
--     - staff can update every row EXCEPT the role column (see trigger below)
--     - INSERT is done by the create-staff-user edge fn (service_role, bypasses RLS)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select_self       on public.profiles;
drop policy if exists profiles_select_staff      on public.profiles;
drop policy if exists profiles_update_self       on public.profiles;
drop policy if exists profiles_update_staff      on public.profiles;

create policy profiles_select_self  on public.profiles
  for select using (id = auth.uid());
create policy profiles_select_staff on public.profiles
  for select using (public.is_staff());

create policy profiles_update_self  on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_staff on public.profiles
  for update using (public.is_staff()) with check (public.is_staff());

-- Block privilege escalation: only an admin may change profiles.role
create or replace function public.prevent_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only an admin can change a profile role';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_prevent_role_change on public.profiles;
create trigger trg_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

-- ---------------------------------------------------------------------------
-- 2.  applicants   — staff only; a student may read the row linked to them
-- ---------------------------------------------------------------------------
alter table public.applicants enable row level security;

drop policy if exists applicants_staff_all   on public.applicants;
drop policy if exists applicants_select_self on public.applicants;

create policy applicants_staff_all on public.applicants
  for all using (public.is_staff()) with check (public.is_staff());

create policy applicants_select_self on public.applicants
  for select using (
    id in (select applicant_id from public.profiles where id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3.  staff        — staff read all; a user may update their own staff row
--                    (matched by email); writes otherwise admin-only
-- ---------------------------------------------------------------------------
alter table public.staff enable row level security;

drop policy if exists staff_select_staff on public.staff;
drop policy if exists staff_write_admin  on public.staff;
drop policy if exists staff_update_self  on public.staff;

create policy staff_select_staff on public.staff
  for select using (public.is_staff());

create policy staff_write_admin on public.staff
  for all using (public.is_admin()) with check (public.is_admin());

create policy staff_update_self on public.staff
  for update using (
    lower(email) = (select lower(email) from public.profiles where id = auth.uid())
  ) with check (
    lower(email) = (select lower(email) from public.profiles where id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 4.  payments   — staff full access; student reads own by NAME match.
--     NOTE: name matching is fragile. Prefer adding payments.profile_id uuid
--     and switching the student policy to (profile_id = auth.uid()).
-- ---------------------------------------------------------------------------
alter table public.payments enable row level security;

drop policy if exists payments_staff_all    on public.payments;
drop policy if exists payments_select_self  on public.payments;

create policy payments_staff_all on public.payments
  for all using (public.is_staff()) with check (public.is_staff());

create policy payments_select_self on public.payments
  for select using (
    lower(student_name) = (
      select lower(coalesce(name,'')) from public.profiles where id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 5.  student_documents   — staff full access; student reads/writes own by EMAIL
-- ---------------------------------------------------------------------------
alter table public.student_documents enable row level security;

drop policy if exists studocs_staff_all   on public.student_documents;
drop policy if exists studocs_rw_self     on public.student_documents;

create policy studocs_staff_all on public.student_documents
  for all using (public.is_staff()) with check (public.is_staff());

create policy studocs_rw_self on public.student_documents
  for all using (
    lower(email) = (select lower(email) from public.profiles where id = auth.uid())
  ) with check (
    lower(email) = (select lower(email) from public.profiles where id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 6.  appointments   — CONFIRM the student-link column (student_email? profile_id?)
-- ---------------------------------------------------------------------------
alter table public.appointments enable row level security;

drop policy if exists appts_staff_all   on public.appointments;
drop policy if exists appts_rw_self     on public.appointments;

create policy appts_staff_all on public.appointments
  for all using (public.is_staff()) with check (public.is_staff());

-- TODO: replace `student_email` with the real column.
create policy appts_rw_self on public.appointments
  for all using (
    lower(coalesce(student_email,'')) = (select lower(email) from public.profiles where id = auth.uid())
  ) with check (
    lower(coalesce(student_email,'')) = (select lower(email) from public.profiles where id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 7.  messages (chat)   — CONFIRM columns. Typical: sender_id, recipient_id,
--     or (student_email, staff visible all). Below: staff all; a user sees a
--     row where they are sender or recipient.
-- ---------------------------------------------------------------------------
alter table public.messages enable row level security;

drop policy if exists messages_staff_all on public.messages;
drop policy if exists messages_rw_self   on public.messages;

create policy messages_staff_all on public.messages
  for all using (public.is_staff()) with check (public.is_staff());

-- TODO: adjust column names (sender_id / recipient_id assumed uuid = auth.uid()).
create policy messages_rw_self on public.messages
  for all using (
    sender_id = auth.uid() or recipient_id = auth.uid()
  ) with check (
    sender_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 8.  tasks / visitors   — internal CRM data, staff only
-- ---------------------------------------------------------------------------
alter table public.tasks    enable row level security;
alter table public.visitors enable row level security;

drop policy if exists tasks_staff_all    on public.tasks;
drop policy if exists visitors_staff_all on public.visitors;

create policy tasks_staff_all on public.tasks
  for all using (public.is_staff()) with check (public.is_staff());
create policy visitors_staff_all on public.visitors
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- 9.  visa_rates   — any authenticated user may read; only admin may write
--     (matches src/lib/visaRates.js + Settings.jsx expectations)
-- ---------------------------------------------------------------------------
alter table public.visa_rates enable row level security;

drop policy if exists visa_rates_read_all    on public.visa_rates;
drop policy if exists visa_rates_write_admin on public.visa_rates;

create policy visa_rates_read_all on public.visa_rates
  for select using (auth.role() = 'authenticated');
create policy visa_rates_write_admin on public.visa_rates
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 10. students   — legacy table. If unused, keep RLS on with NO policy
--     (deny-all). If used, add policies mirroring `applicants`.
-- ---------------------------------------------------------------------------
-- alter table public.students enable row level security;

-- ---------------------------------------------------------------------------
-- 11. Storage buckets
--     avatars      : public read, authenticated write (any signed-in user)
--     student-docs : decide — if it must stay public, leave as-is; to lock it,
--                    make the bucket private and switch app to createSignedUrl().
-- ---------------------------------------------------------------------------
-- avatars: allow any authenticated user to manage objects in the bucket
drop policy if exists "avatars auth write"  on storage.objects;
drop policy if exists "avatars public read" on storage.objects;

create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars auth write" on storage.objects
  for all to authenticated
  using (bucket_id = 'avatars')
  with check (bucket_id = 'avatars');

-- ============================================================================
-- SMOKE TEST (run as a student, then as each staff role, from the app):
--   * student: can see ONLY their own applicant / payments / documents
--   * student: /rest/v1/profiles?select=* returns just their row
--   * staff:   every CRM page still loads with data
--   * anyone non-admin: UPDATE profiles SET role='admin' WHERE id=<self>  -> denied
-- ============================================================================

-- ============================================================================
-- ROLLBACK  (paste this block if anything locks users out)
-- ============================================================================
-- alter table public.profiles          disable row level security;
-- alter table public.applicants        disable row level security;
-- alter table public.staff             disable row level security;
-- alter table public.payments          disable row level security;
-- alter table public.student_documents disable row level security;
-- alter table public.appointments      disable row level security;
-- alter table public.messages          disable row level security;
-- alter table public.tasks             disable row level security;
-- alter table public.visitors          disable row level security;
-- alter table public.visa_rates        disable row level security;
-- drop trigger  if exists trg_prevent_role_change on public.profiles;
-- ============================================================================

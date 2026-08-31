-- ============================================================================
-- security-rls-policies.sql   —   Row Level Security for GPCRM
-- ----------------------------------------------------------------------------
-- 2026-08-31: column names corrected against the live app query surface.
-- Fully idempotent — safe to run (and re-run) top to bottom in the Supabase
-- SQL editor. A rollback block is at the bottom.
--
-- Verified columns (from src/ queries):
--   profiles(id uuid PK = auth.users.id, email, name, phone, phone_new,
--            role, applicant_id uuid -> applicants.id, avatar_url)
--   applicants(id uuid PK, name, email, phone, course, country, status, created_at)
--   staff(id uuid PK, name, role, email, phone, phone_new, joined, avatar_url)
--   payments(student_name, student_email, amount, method, status, date, type, note)
--   student_documents(applicant_id, student_name, student_email, doc_type,
--                     status, note, file_url, updated_at)
--   appointments(student_name, student_email, date, time, status, created_at)
--   messages(message, sender_name, sender_email, sender_role,
--            receiver_name, receiver_email, is_read, created_at)
--   tasks / visitors  -> internal CRM data, staff only (no student columns needed)
--   visa_rates(country PK, rate, updated_at, updated_by)
--   announcements      -> RLS already set by announcements.sql; not touched here
--   students           -> legacy; left alone
--
-- "staff" roles: admin, staff, finance_officer, document_handler,
--                receptionist, counselor, visa_officer
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0.  Helpers.  SECURITY DEFINER => they bypass RLS, so the policies that
--     call them don't recurse on profiles.
-- ---------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','staff','finance_officer','document_handler',
                     'receptionist','counselor','visa_officer')
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

revoke all on function public.is_staff() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 1.  profiles
--     own row: read + update.  staff: read + update all.
--     role column can only be changed by an admin (trigger).
--     INSERT stays with the service-role edge function (RLS-exempt).
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select_self  on public.profiles;
drop policy if exists profiles_select_staff on public.profiles;
drop policy if exists profiles_update_self  on public.profiles;
drop policy if exists profiles_update_staff on public.profiles;

create policy profiles_select_self  on public.profiles
  for select using (id = auth.uid());
create policy profiles_select_staff on public.profiles
  for select using (public.is_staff());
create policy profiles_update_self  on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_staff on public.profiles
  for update using (public.is_staff()) with check (public.is_staff());

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
-- 2.  applicants   — staff: all.  student: only the row linked to them.
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
-- 3.  staff   — staff: read all.  admin: write all.
--     a signed-in user may update their own staff row (matched by email).
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
-- 4.  payments   — staff: all.  student: read own rows (by student_email).
-- ---------------------------------------------------------------------------
alter table public.payments enable row level security;

drop policy if exists payments_staff_all   on public.payments;
drop policy if exists payments_select_self on public.payments;

create policy payments_staff_all on public.payments
  for all using (public.is_staff()) with check (public.is_staff());
create policy payments_select_self on public.payments
  for select using (
    lower(coalesce(student_email,'')) =
      (select lower(coalesce(email,'')) from public.profiles where id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 5.  student_documents   — staff: all.  student: read/write own (student_email).
-- ---------------------------------------------------------------------------
alter table public.student_documents enable row level security;

drop policy if exists studocs_staff_all on public.student_documents;
drop policy if exists studocs_rw_self   on public.student_documents;

create policy studocs_staff_all on public.student_documents
  for all using (public.is_staff()) with check (public.is_staff());
create policy studocs_rw_self on public.student_documents
  for all using (
    lower(coalesce(student_email,'')) =
      (select lower(coalesce(email,'')) from public.profiles where id = auth.uid())
  ) with check (
    lower(coalesce(student_email,'')) =
      (select lower(coalesce(email,'')) from public.profiles where id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 6.  appointments   — staff: all.  student: read/write own (student_email).
-- ---------------------------------------------------------------------------
alter table public.appointments enable row level security;

drop policy if exists appts_staff_all on public.appointments;
drop policy if exists appts_rw_self   on public.appointments;

create policy appts_staff_all on public.appointments
  for all using (public.is_staff()) with check (public.is_staff());
create policy appts_rw_self on public.appointments
  for all using (
    lower(coalesce(student_email,'')) =
      (select lower(coalesce(email,'')) from public.profiles where id = auth.uid())
  ) with check (
    lower(coalesce(student_email,'')) =
      (select lower(coalesce(email,'')) from public.profiles where id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 7.  messages (chat)   — staff: all.  a user sees / sends rows where their
--     email is the sender or the receiver.
-- ---------------------------------------------------------------------------
alter table public.messages enable row level security;

drop policy if exists messages_staff_all on public.messages;
drop policy if exists messages_select_self on public.messages;
drop policy if exists messages_insert_self on public.messages;
drop policy if exists messages_update_self on public.messages;

create policy messages_staff_all on public.messages
  for all using (public.is_staff()) with check (public.is_staff());

create policy messages_select_self on public.messages
  for select using (
    (select lower(coalesce(email,'')) from public.profiles where id = auth.uid())
      in (lower(coalesce(sender_email,'')), lower(coalesce(receiver_email,'')))
  );

create policy messages_insert_self on public.messages
  for insert with check (
    lower(coalesce(sender_email,'')) =
      (select lower(coalesce(email,'')) from public.profiles where id = auth.uid())
  );

-- lets the recipient flip is_read on messages addressed to them
create policy messages_update_self on public.messages
  for update using (
    lower(coalesce(receiver_email,'')) =
      (select lower(coalesce(email,'')) from public.profiles where id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 8.  tasks / visitors   — internal CRM data, staff only.
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
-- 9.  visa_rates   — any authenticated user reads.  admin writes.
-- ---------------------------------------------------------------------------
alter table public.visa_rates enable row level security;

drop policy if exists visa_rates_read_all    on public.visa_rates;
drop policy if exists visa_rates_write_admin on public.visa_rates;

create policy visa_rates_read_all on public.visa_rates
  for select to authenticated using (true);
create policy visa_rates_write_admin on public.visa_rates
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 10. Storage — avatars bucket: public read, any signed-in user writes.
--     (student-docs is left exactly as it is now.)
-- ---------------------------------------------------------------------------
drop policy if exists "avatars public read" on storage.objects;
drop policy if exists "avatars auth write"  on storage.objects;

create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars auth write" on storage.objects
  for all to authenticated
  using (bucket_id = 'avatars')
  with check (bucket_id = 'avatars');

-- ============================================================================
-- SMOKE TEST after running (from the app):
--   * student logs in, sees dashboard, only their own payments / docs / appts
--   * each staff role logs in, every page still loads with data
--   * chat works both directions
--   * as a non-admin:  update profiles set role='admin' where id = auth.uid();
--     -> must fail with "Only an admin can change a profile role"
-- ============================================================================

-- ============================================================================
-- ROLLBACK  — paste this if anything locks users out
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
-- drop trigger if exists trg_prevent_role_change on public.profiles;
-- ============================================================================

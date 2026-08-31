-- ─────────────────────────────────────────────────────────────────────────────
-- visa_rates
-- Admin-editable student-visa success rates shown on the Students page country
-- cards. Edited from the CRM: Settings → Visa Rates (admin only).
-- Run this once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.visa_rates (
  country     text primary key,
  rate        numeric not null check (rate >= 0 and rate <= 100),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);

alter table public.visa_rates enable row level security;

-- Any signed-in user (staff or student) may read the rates.
drop policy if exists "visa_rates_read" on public.visa_rates;
create policy "visa_rates_read"
  on public.visa_rates
  for select
  to authenticated
  using (true);

-- Only admins may insert / update / delete.
drop policy if exists "visa_rates_admin_write" on public.visa_rates;
create policy "visa_rates_admin_write"
  on public.visa_rates
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Seed with the current values (from src/lib/visaRates.js DEFAULT_VISA_RATES).
-- on conflict do nothing → re-running this file won't clobber admin edits.
insert into public.visa_rates (country, rate) values
  ('Korea',     85),
  ('Australia', 40),
  ('Japan',     88),
  ('UK',        95),
  ('USA',       19),
  ('Canada',    57),
  ('Finland',   88)
on conflict (country) do nothing;

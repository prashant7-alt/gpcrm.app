-- ─────────────────────────────────────────────────────────────────────────────
-- announcements
-- Admin-posted news / information shown on the staff and student dashboards.
-- Managed from the CRM: the Announcements panel on the admin dashboard
-- (create / edit / delete) — visible to admin only. Everyone else reads.
-- Run this once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  audience    text not null default 'all' check (audience in ('all', 'staff', 'students')),
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null
);

create index if not exists announcements_order_idx
  on public.announcements (pinned desc, created_at desc);

alter table public.announcements enable row level security;

-- Any signed-in user (staff or student) may read announcements.
drop policy if exists "announcements_read" on public.announcements;
create policy "announcements_read"
  on public.announcements
  for select
  to authenticated
  using (true);

-- Only admins may insert / update / delete.
drop policy if exists "announcements_admin_write" on public.announcements;
create policy "announcements_admin_write"
  on public.announcements
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

-- Keep updated_at fresh on edits.
create or replace function public.touch_announcements_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists trg_touch_announcements on public.announcements;
create trigger trg_touch_announcements
  before update on public.announcements
  for each row execute function public.touch_announcements_updated_at();

-- Run this ONCE in the Supabase SQL editor if you already created the
-- database earlier (before the email-backup feature was added).

create table if not exists public.app_state (
  id                          int primary key default 1,
  last_export_sent_at         timestamptz,
  last_export_acknowledged_at timestamptz,
  constraint app_state_singleton check (id = 1)
);

insert into public.app_state (id) values (1) on conflict (id) do nothing;

alter table public.app_state enable row level security;

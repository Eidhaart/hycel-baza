-- ============================================================
--  Rejestr zwierząt — schema, security, storage and seed data
--  Run this once in the Supabase SQL editor for a fresh project.
-- ============================================================

-- Gminy (municipalities) --------------------------------------
create table if not exists public.gminas (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  code       text not null unique,
  created_at timestamptz not null default now()
);

-- Animals -----------------------------------------------------
create table if not exists public.animals (
  id            uuid primary key default gen_random_uuid(),
  data          date,
  gmina_id      uuid references public.gminas(id) on delete restrict,
  gmina_name    text,
  miejsce       text,
  zglaszajacy   text,
  opis          text not null,
  chip          text,
  dostarczenie  text,
  los           text,
  status        text not null default 'przetrzymany',
  zdjecie       text,        -- public URL of the photo
  photo_path    text,        -- storage path (used for replace/delete)
  created_at    timestamptz not null default now()
);

create index if not exists animals_gmina_idx on public.animals (gmina_id);
create index if not exists animals_data_idx  on public.animals (data desc);

-- App state (single row) — tracks the backup-email cadence ----
create table if not exists public.app_state (
  id                        int primary key default 1,
  last_export_sent_at       timestamptz,
  last_export_acknowledged_at timestamptz,
  constraint app_state_singleton check (id = 1)
);
insert into public.app_state (id) values (1) on conflict (id) do nothing;

-- Row Level Security ------------------------------------------
-- The app only ever talks to the database through the server using the
-- service_role key, which bypasses RLS. We still enable RLS with NO public
-- policies, so the anon/public key cannot read or write anything directly.
alter table public.gminas  enable row level security;
alter table public.animals enable row level security;
alter table public.app_state enable row level security;

-- Storage bucket for photos -----------------------------------
insert into storage.buckets (id, name, public)
values ('animal-photos', 'animal-photos', true)
on conflict (id) do nothing;

-- Allow anyone to READ photos (they are shown by public URL).
-- Uploads/deletes happen server-side via service_role, so no write policy
-- for the public role is required.
drop policy if exists "Public read animal photos" on storage.objects;
create policy "Public read animal photos"
  on storage.objects for select
  using ( bucket_id = 'animal-photos' );

-- ============================================================
--  Seed data (gmina Legionowo, from the client's existing list)
--  Safe to delete this whole block if you want an empty start.
-- ============================================================

insert into public.gminas (id, name, code) values
  ('11111111-1111-1111-1111-111111111111', 'Legionowo', 'LEG1'),
  ('22222222-2222-2222-2222-222222222222', 'Jabłonna',  'JAB1'),
  ('33333333-3333-3333-3333-333333333333', 'Nieporęt',  'NIE1')
on conflict (id) do nothing;

insert into public.animals (data, gmina_id, gmina_name, miejsce, zglaszajacy, opis, chip, dostarczenie, los, status) values
  ('2026-03-03', '11111111-1111-1111-1111-111111111111', 'Legionowo', 'Legionowo, ul. Czarnieckiego 8', 'Straż miejska', 'Sarna dorosła', null, 'Ośrodek rehabilitacji Błędowo', null, 'rehabilitacja'),
  (null,         '11111111-1111-1111-1111-111111111111', 'Legionowo', 'Legionowo, ul. Sienkiewicza', 'Straż miejska', 'Suka ok. 1,5 roku, wilczasta, średniej wielkości', null, 'Zwrócona właścicielowi', 'Sylwia Zbrzezna, ul. Grudzie 34, Legionowo. Tel. 517 873 188', 'zwrocony'),
  ('2026-03-22', '11111111-1111-1111-1111-111111111111', 'Legionowo', 'legvet', 'UG', 'Pies mix rudy, wiek ok. 4 lata', null, 'Czasowo przetrzymany', 'Zwrócony właścicielowi 23.03.2026 – Malecki Oleksandr, Jonatan, Jabłonna. Tel. 883 635 797', 'zwrocony'),
  ('2026-04-02', '11111111-1111-1111-1111-111111111111', 'Legionowo', 'Legionowo, Warszawska 40/40', 'UG', 'Pies, suka mix amstaff', '616093900146358', 'Przekazana pod opiekę sąsiadce', 'Monika Sykson-Krzemińska, Jagiellońska 4/17, Legionowo. Tel. 513 335 974', 'przekazany'),
  ('2024-04-13', '11111111-1111-1111-1111-111111111111', 'Legionowo', 'Legionowo, ul. Krasińskiego', 'Straż miejska', 'Młody łoś', null, 'Ośrodek rehabilitacji dzikich zwierząt w Błędowie', null, 'rehabilitacja'),
  ('2026-05-01', '11111111-1111-1111-1111-111111111111', 'Legionowo', 'Legionowo, Parkowa 10a', 'Straż miejska', 'Piesek ok. 10 lat', '616093902295529', 'Czasowo przetrzymany', 'Zwrócony właścicielowi 02.05.2026 – Malinowska Krystyna, Michałów-Reginów, Nowodworska 15', 'zwrocony'),
  ('2026-05-16', '11111111-1111-1111-1111-111111111111', 'Legionowo', 'Straż miejska – siedziba', 'Straż miejska', 'Pies, samiec rudy z czarnym nalotem', null, 'Czasowo przetrzymany', 'Odwieziony do schroniska Viva w Korabiewicach 19.05.2026', 'schronisko'),
  ('2026-05-25', '11111111-1111-1111-1111-111111111111', 'Legionowo', 'legvet AniCura', 'UG', 'Suczka szorstkowłosa, mix czarna z białymi odmianami, wiek ponad 10 lat. Widoczna zmiana nowotworowa na lewej tylnej łapie.', null, 'Schronisko VIVA', null, 'schronisko'),
  ('2026-05-25', '11111111-1111-1111-1111-111111111111', 'Legionowo', 'Legionowo, Stefana Czarnieckiego 75', 'UG', 'Pies mix średni, wilczasty, wiek ponad 10 lat', null, 'Schronisko VIVA', null, 'schronisko'),
  ('2026-05-26', '11111111-1111-1111-1111-111111111111', 'Legionowo', 'Policja Legionowo', 'Policja', 'Pinczer', null, 'Zwrócony właścicielowi', null, 'zwrocony'),
  ('2026-07-11', '11111111-1111-1111-1111-111111111111', 'Legionowo', 'Przemysłowa 8 m. 12', 'Policja', 'Pies Amstaff ok. 1 rok, łaciaty', null, 'Czasowo przetrzymany', 'Dostarczony do schroniska Viva 13.07.2026', 'schronisko');

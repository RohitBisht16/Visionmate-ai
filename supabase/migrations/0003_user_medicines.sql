-- Visionmate: user medication list
-- Run this in Supabase SQL Editor.
-- This creates the table used by the dashboard Active Medicines card.

create table if not exists public.user_medicines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  medicine_name text not null,
  generic_name text,
  active_ingredient text,
  strength text,
  dosage_form text,
  frequency text,
  duration text,
  instructions text,
  manufacturer text,
  expiry_date date,
  source text,
  source_prescription_id uuid references public.prescriptions(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_medicines add column if not exists generic_name text;
alter table public.user_medicines add column if not exists active_ingredient text;
alter table public.user_medicines add column if not exists strength text;
alter table public.user_medicines add column if not exists dosage_form text;
alter table public.user_medicines add column if not exists frequency text;
alter table public.user_medicines add column if not exists duration text;
alter table public.user_medicines add column if not exists instructions text;
alter table public.user_medicines add column if not exists manufacturer text;
alter table public.user_medicines add column if not exists expiry_date date;
alter table public.user_medicines add column if not exists source text;
alter table public.user_medicines add column if not exists source_prescription_id uuid;
alter table public.user_medicines add column if not exists status text default 'active';
alter table public.user_medicines add column if not exists notes text;
alter table public.user_medicines add column if not exists created_at timestamptz default now();
alter table public.user_medicines add column if not exists updated_at timestamptz default now();

create index if not exists user_medicines_user_id_idx
  on public.user_medicines(user_id);

create index if not exists user_medicines_status_idx
  on public.user_medicines(user_id, status);

alter table public.user_medicines enable row level security;

drop policy if exists "Users can view own medicines" on public.user_medicines;
create policy "Users can view own medicines"
  on public.user_medicines for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own medicines" on public.user_medicines;
create policy "Users can insert own medicines"
  on public.user_medicines for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own medicines" on public.user_medicines;
create policy "Users can update own medicines"
  on public.user_medicines for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own medicines" on public.user_medicines;
create policy "Users can delete own medicines"
  on public.user_medicines for delete
  using (auth.uid() = user_id);

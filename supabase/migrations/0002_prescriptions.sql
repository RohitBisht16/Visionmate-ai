-- Visionmate prescription storage
-- Run this migration in Supabase SQL Editor before using /prescription.

create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  raw_ocr_text text not null,
  ocr_confidence numeric,
  status text not null default 'needs_review'
    check (status in ('needs_review', 'verified')),
  created_at timestamptz not null default now()
);

create table if not exists public.prescription_medicines (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  medicine_name text not null,
  strength text,
  frequency text,
  duration text,
  instructions text,
  ocr_confidence numeric,
  created_at timestamptz not null default now()
);

alter table public.prescriptions enable row level security;
alter table public.prescription_medicines enable row level security;

drop policy if exists "Users can read own prescriptions" on public.prescriptions;
create policy "Users can read own prescriptions"
on public.prescriptions for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own prescriptions" on public.prescriptions;
create policy "Users can insert own prescriptions"
on public.prescriptions for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own prescriptions" on public.prescriptions;
create policy "Users can update own prescriptions"
on public.prescriptions for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own prescriptions" on public.prescriptions;
create policy "Users can delete own prescriptions"
on public.prescriptions for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own prescription medicines" on public.prescription_medicines;
create policy "Users can read own prescription medicines"
on public.prescription_medicines for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own prescription medicines" on public.prescription_medicines;
create policy "Users can insert own prescription medicines"
on public.prescription_medicines for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.prescriptions p
    where p.id = prescription_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own prescription medicines" on public.prescription_medicines;
create policy "Users can update own prescription medicines"
on public.prescription_medicines for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own prescription medicines" on public.prescription_medicines;
create policy "Users can delete own prescription medicines"
on public.prescription_medicines for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists prescriptions_user_id_created_at_idx
  on public.prescriptions(user_id, created_at desc);

create index if not exists prescription_medicines_user_id_idx
  on public.prescription_medicines(user_id);

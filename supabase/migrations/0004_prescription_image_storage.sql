-- 0004: private prescription image storage
alter table public.prescriptions
  add column if not exists image_path text;

insert into storage.buckets (id, name, public)
values ('prescriptions', 'prescriptions', false)
on conflict (id) do update set public = false;

drop policy if exists "Users can view own prescription images" on storage.objects;
create policy "Users can view own prescription images"
on storage.objects for select to authenticated
using (bucket_id = 'prescriptions' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "Users can upload own prescription images" on storage.objects;
create policy "Users can upload own prescription images"
on storage.objects for insert to authenticated
with check (bucket_id = 'prescriptions' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "Users can delete own prescription images" on storage.objects;
create policy "Users can delete own prescription images"
on storage.objects for delete to authenticated
using (bucket_id = 'prescriptions' and (storage.foldername(name))[1] = (select auth.uid()::text));

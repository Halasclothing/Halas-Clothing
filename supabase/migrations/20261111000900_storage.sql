-- 09 — Supabase Storage bucket and policies for product media.

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'storage schema not present; skipping product-images bucket setup.';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'product-images',
    'product-images',
    true,
    8388608,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  )
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists "product images are publicly readable" on storage.objects';
  execute 'create policy "product images are publicly readable" on storage.objects
             for select to anon, authenticated
             using (bucket_id = ''product-images'')';

  execute 'drop policy if exists "admins upload product images" on storage.objects';
  execute 'create policy "admins upload product images" on storage.objects
             for insert to authenticated
             with check (bucket_id = ''product-images'' and public.is_admin())';

  execute 'drop policy if exists "admins update product images" on storage.objects';
  execute 'create policy "admins update product images" on storage.objects
             for update to authenticated
             using (bucket_id = ''product-images'' and public.is_admin())
             with check (bucket_id = ''product-images'' and public.is_admin())';

  execute 'drop policy if exists "admins delete product images" on storage.objects';
  execute 'create policy "admins delete product images" on storage.objects
             for delete to authenticated
             using (bucket_id = ''product-images'' and public.is_admin())';
end;
$$;

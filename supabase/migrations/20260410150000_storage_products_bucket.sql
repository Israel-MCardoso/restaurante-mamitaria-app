insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'products',
  'products',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  create policy "Public can read product images"
  on storage.objects for select
  using (bucket_id = 'products');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Restaurant admins can upload product images"
  on storage.objects for insert
  with check (
    bucket_id = 'products'
    and split_part(name, '/', 1) in (
      select restaurant_id::text
      from profiles
      where id = auth.uid()
        and role in ('admin', 'manager')
    )
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Restaurant admins can update product images"
  on storage.objects for update
  using (
    bucket_id = 'products'
    and split_part(name, '/', 1) in (
      select restaurant_id::text
      from profiles
      where id = auth.uid()
        and role in ('admin', 'manager')
    )
  )
  with check (
    bucket_id = 'products'
    and split_part(name, '/', 1) in (
      select restaurant_id::text
      from profiles
      where id = auth.uid()
        and role in ('admin', 'manager')
    )
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Restaurant admins can delete product images"
  on storage.objects for delete
  using (
    bucket_id = 'products'
    and split_part(name, '/', 1) in (
      select restaurant_id::text
      from profiles
      where id = auth.uid()
        and role in ('admin', 'manager')
    )
  );
exception
  when duplicate_object then null;
end $$;

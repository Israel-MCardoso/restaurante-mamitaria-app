create or replace function public.current_profile_restaurant_id()
returns uuid
language sql
stable
as $$
  select restaurant_id
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

create or replace function public.current_profile_role()
returns text
language sql
stable
as $$
  select role
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

drop policy if exists "Admins can manage products" on public.products;
drop policy if exists "Admins can insert products for their restaurant" on public.products;
drop policy if exists "Admins can update products for their restaurant" on public.products;
drop policy if exists "Admins can delete products for their restaurant" on public.products;

create policy "Admins can insert products for their restaurant"
on public.products
for insert
to authenticated
with check (
  auth.uid() is not null
  and public.current_profile_role() in ('admin', 'manager')
  and restaurant_id = public.current_profile_restaurant_id()
  and exists (
    select 1
    from public.categories category
    where category.id = products.category_id
      and category.restaurant_id = public.current_profile_restaurant_id()
  )
);

create policy "Admins can update products for their restaurant"
on public.products
for update
to authenticated
using (
  auth.uid() is not null
  and public.current_profile_role() in ('admin', 'manager')
  and restaurant_id = public.current_profile_restaurant_id()
)
with check (
  auth.uid() is not null
  and public.current_profile_role() in ('admin', 'manager')
  and restaurant_id = public.current_profile_restaurant_id()
  and exists (
    select 1
    from public.categories category
    where category.id = products.category_id
      and category.restaurant_id = public.current_profile_restaurant_id()
  )
);

create policy "Admins can delete products for their restaurant"
on public.products
for delete
to authenticated
using (
  auth.uid() is not null
  and public.current_profile_role() in ('admin', 'manager')
  and restaurant_id = public.current_profile_restaurant_id()
);

drop policy if exists "Restaurant admins can upload product images" on storage.objects;
drop policy if exists "Restaurant admins can update product images" on storage.objects;
drop policy if exists "Restaurant admins can delete product images" on storage.objects;

create policy "Restaurant admins can upload product images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'products'
  and auth.uid() is not null
  and public.current_profile_role() in ('admin', 'manager')
  and split_part(name, '/', 1) = public.current_profile_restaurant_id()::text
  and split_part(name, '/', 2) in ('products', 'settings')
);

create policy "Restaurant admins can update product images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'products'
  and auth.uid() is not null
  and public.current_profile_role() in ('admin', 'manager')
  and split_part(name, '/', 1) = public.current_profile_restaurant_id()::text
)
with check (
  bucket_id = 'products'
  and auth.uid() is not null
  and public.current_profile_role() in ('admin', 'manager')
  and split_part(name, '/', 1) = public.current_profile_restaurant_id()::text
  and split_part(name, '/', 2) in ('products', 'settings')
);

create policy "Restaurant admins can delete product images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'products'
  and auth.uid() is not null
  and public.current_profile_role() in ('admin', 'manager')
  and split_part(name, '/', 1) = public.current_profile_restaurant_id()::text
);

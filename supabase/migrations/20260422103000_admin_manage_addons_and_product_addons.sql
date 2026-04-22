drop policy if exists "Admins can manage addons" on public.addons;
drop policy if exists "Admins can manage product_addons" on public.product_addons;

create policy "Admins can manage addons"
on public.addons
for all
using (
  restaurant_id in (
    select restaurant_id
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'manager')
  )
)
with check (
  restaurant_id in (
    select restaurant_id
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'manager')
  )
);

create policy "Admins can manage product_addons"
on public.product_addons
for all
using (
  exists (
    select 1
    from public.products
    join public.profiles
      on public.profiles.restaurant_id = public.products.restaurant_id
    where public.products.id = public.product_addons.product_id
      and public.profiles.id = auth.uid()
      and public.profiles.role in ('admin', 'manager')
  )
  and exists (
    select 1
    from public.addons
    join public.profiles
      on public.profiles.restaurant_id = public.addons.restaurant_id
    where public.addons.id = public.product_addons.addon_id
      and public.profiles.id = auth.uid()
      and public.profiles.role in ('admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.products
    join public.profiles
      on public.profiles.restaurant_id = public.products.restaurant_id
    where public.products.id = public.product_addons.product_id
      and public.profiles.id = auth.uid()
      and public.profiles.role in ('admin', 'manager')
  )
  and exists (
    select 1
    from public.addons
    join public.profiles
      on public.profiles.restaurant_id = public.addons.restaurant_id
    where public.addons.id = public.product_addons.addon_id
      and public.profiles.id = auth.uid()
      and public.profiles.role in ('admin', 'manager')
  )
);

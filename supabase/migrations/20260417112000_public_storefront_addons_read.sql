drop policy if exists "Addons are viewable by everyone" on public.addons;
drop policy if exists "Product addons are viewable by everyone" on public.product_addons;

create policy "Addons are viewable by everyone"
on public.addons
for select
using (true);

create policy "Product addons are viewable by everyone"
on public.product_addons
for select
using (true);

create extension if not exists pgcrypto;

create table if not exists public.restaurant_payment_integrations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  provider text not null check (provider = 'mercado_pago'),
  access_token text not null,
  public_key text not null,
  webhook_secret text,
  webhook_url text,
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, provider)
);

alter table public.restaurant_payment_integrations enable row level security;

create or replace function public.touch_restaurant_payment_integrations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists restaurant_payment_integrations_touch_updated_at
on public.restaurant_payment_integrations;

create trigger restaurant_payment_integrations_touch_updated_at
before update on public.restaurant_payment_integrations
for each row
execute function public.touch_restaurant_payment_integrations_updated_at();

drop policy if exists "Restaurant admins can view payment integrations"
on public.restaurant_payment_integrations;

create policy "Restaurant admins can view payment integrations"
on public.restaurant_payment_integrations
for select
to authenticated
using (
  auth.uid() is not null
  and public.current_profile_role() in ('admin', 'manager')
  and restaurant_id = public.current_profile_restaurant_id()
);

drop policy if exists "Restaurant admins can insert payment integrations"
on public.restaurant_payment_integrations;

create policy "Restaurant admins can insert payment integrations"
on public.restaurant_payment_integrations
for insert
to authenticated
with check (
  auth.uid() is not null
  and public.current_profile_role() in ('admin', 'manager')
  and restaurant_id = public.current_profile_restaurant_id()
);

drop policy if exists "Restaurant admins can update payment integrations"
on public.restaurant_payment_integrations;

create policy "Restaurant admins can update payment integrations"
on public.restaurant_payment_integrations
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
);

drop policy if exists "Restaurant admins can delete payment integrations"
on public.restaurant_payment_integrations;

create policy "Restaurant admins can delete payment integrations"
on public.restaurant_payment_integrations
for delete
to authenticated
using (
  auth.uid() is not null
  and public.current_profile_role() in ('admin', 'manager')
  and restaurant_id = public.current_profile_restaurant_id()
);

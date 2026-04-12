alter table public.orders
  add column if not exists access_token text;

alter table public.orders
  alter column access_token set default gen_random_uuid()::text;

update public.orders
set access_token = coalesce(access_token, gen_random_uuid()::text)
where access_token is null;

alter table public.orders
  alter column access_token set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_access_token_key'
  ) then
    alter table public.orders
      add constraint orders_access_token_key unique (access_token);
  end if;
end $$;

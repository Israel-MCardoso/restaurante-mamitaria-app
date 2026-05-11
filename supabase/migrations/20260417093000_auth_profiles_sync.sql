create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  resolved_role text;
  resolved_restaurant_id uuid;
  resolved_full_name text;
  raw_restaurant_id text;
begin
  if coalesce(new.raw_app_meta_data->>'role', '') in ('admin', 'manager', 'staff', 'customer') then
    resolved_role := new.raw_app_meta_data->>'role';
  elsif tg_op = 'INSERT' and coalesce(new.raw_user_meta_data->>'role', '') = 'customer' then
    resolved_role := 'customer';
  else
    resolved_role := null;
  end if;

  raw_restaurant_id := nullif(
    coalesce(
      new.raw_app_meta_data->>'restaurant_id',
      case
        when resolved_role = 'customer' then new.raw_user_meta_data->>'restaurant_id'
        else null
      end
    ),
    ''
  );

  begin
    resolved_restaurant_id := case when raw_restaurant_id is null then null else raw_restaurant_id::uuid end;
  exception
    when invalid_text_representation then
      resolved_restaurant_id := null;
  end;

  resolved_full_name := nullif(
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    ''
  );

  update public.profiles
  set
    restaurant_id = coalesce(resolved_restaurant_id, profiles.restaurant_id),
    full_name = coalesce(resolved_full_name, profiles.full_name),
    role = coalesce(resolved_role, profiles.role)
  where id = new.id;

  if not found then
    insert into public.profiles (
      id,
      restaurant_id,
      full_name,
      role
    )
    values (
      new.id,
      resolved_restaurant_id,
      resolved_full_name,
      coalesce(resolved_role, 'customer')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_profile_sync on auth.users;

create trigger on_auth_user_profile_sync
after insert or update of raw_user_meta_data, raw_app_meta_data, email
on auth.users
for each row
execute procedure public.sync_profile_from_auth_user();

insert into public.profiles (
  id,
  restaurant_id,
  full_name,
  role
)
select
  auth_user.id,
  case
    when nullif(auth_user.raw_app_meta_data->>'restaurant_id', '') is null then null
    else (auth_user.raw_app_meta_data->>'restaurant_id')::uuid
  end as restaurant_id,
  nullif(
    coalesce(
      auth_user.raw_user_meta_data->>'full_name',
      auth_user.raw_user_meta_data->>'name'
    ),
    ''
  ) as full_name,
  case
    when coalesce(auth_user.raw_app_meta_data->>'role', '') in ('admin', 'manager', 'staff', 'customer')
      then auth_user.raw_app_meta_data->>'role'
    when coalesce(auth_user.raw_user_meta_data->>'role', '') = 'customer'
      then 'customer'
    else 'customer'
  end as role
from auth.users auth_user
on conflict (id) do update
set
  restaurant_id = coalesce(excluded.restaurant_id, profiles.restaurant_id),
  full_name = coalesce(excluded.full_name, profiles.full_name),
  role = coalesce(excluded.role, profiles.role);

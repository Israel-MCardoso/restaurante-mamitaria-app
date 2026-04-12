create or replace function public.normalize_order_status(input_status text)
returns text
language sql
immutable
as $$
  select case
    when input_status = 'shipped' then 'out_for_delivery'
    else input_status
  end;
$$;

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  note text,
  source text,
  created_at timestamptz not null default now(),
  constraint order_status_history_status_check
    check (status in ('pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'))
);

create index if not exists order_status_history_order_id_created_at_idx
  on public.order_status_history(order_id, created_at, id);

insert into public.order_status_history (
  order_id,
  status,
  note,
  source,
  created_at
)
select
  o.id,
  public.normalize_order_status(o.status::text),
  null,
  'backfill',
  o.created_at
from public.orders o
where not exists (
  select 1
  from public.order_status_history osh
  where osh.order_id = o.id
);

create or replace function public.build_canonical_order(order_row public.orders)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'order_id', order_row.id,
    'order_number', order_row.order_number,
    'status', case when order_row.status::text = 'shipped' then 'out_for_delivery' else order_row.status::text end,
    'payment_method', order_row.payment_method,
    'payment_status', order_row.payment_status,
    'subtotal', order_row.subtotal,
    'delivery_fee', order_row.delivery_fee,
    'discount_amount', order_row.discount_amount,
    'total_amount', order_row.total_amount,
    'estimated_time_minutes', order_row.estimated_time_minutes,
    'fulfillment_type', order_row.fulfillment_type,
    'items',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'item_id', oi.id,
            'product_id', oi.product_id,
            'product_name', oi.product_name,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'subtotal', oi.subtotal,
            'notes', oi.observations,
            'addons', coalesce(oi.addons_json, '[]'::jsonb)
          )
          order by oi.id
        )
        from public.order_items oi
        where oi.order_id = order_row.id
      ), '[]'::jsonb),
    'payment_data', order_row.payment_data,
    'customer', jsonb_build_object(
      'name', order_row.customer_name,
      'phone', order_row.customer_phone
    ),
    'delivery_address', order_row.delivery_address,
    'status_history',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'status', osh.status,
            'changed_at', osh.created_at,
            'note', osh.note,
            'source', osh.source
          )
          order by osh.created_at, osh.id
        )
        from public.order_status_history osh
        where osh.order_id = order_row.id
      ), '[]'::jsonb),
    'created_at', order_row.created_at,
    'updated_at', order_row.updated_at
  );
$$;

create or replace function public.append_order_status_history(
  order_id_input uuid,
  status_input text,
  note_input text default null,
  source_input text default 'system'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_status text;
begin
  normalized_status := public.normalize_order_status(status_input);

  if normalized_status not in ('pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled') then
    raise exception 'INVALID_ORDER_STATUS';
  end if;

  insert into public.order_status_history (
    order_id,
    status,
    note,
    source
  )
  values (
    order_id_input,
    normalized_status,
    nullif(trim(coalesce(note_input, '')), ''),
    nullif(trim(coalesce(source_input, '')), '')
  );
end;
$$;

create or replace function public.sync_order_status_history_from_orders()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  previous_status text;
  next_status text;
begin
  previous_status := case
    when tg_op = 'UPDATE' then public.normalize_order_status(old.status::text)
    else null
  end;

  next_status := public.normalize_order_status(new.status::text);

  if tg_op = 'INSERT' then
    perform public.append_order_status_history(new.id, next_status, null, 'order_insert');
  elsif previous_status is distinct from next_status then
    perform public.append_order_status_history(new.id, next_status, null, 'order_update');
  end if;

  return new;
end;
$$;

drop trigger if exists orders_sync_status_history on public.orders;

create trigger orders_sync_status_history
after insert or update of status on public.orders
for each row
execute function public.sync_order_status_history_from_orders();

create or replace function public.sync_order_idempotency_response_by_order_id(order_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
begin
  select *
  into order_row
  from public.orders
  where id = order_id_input;

  if order_row.id is null then
    return;
  end if;

  update public.order_idempotency_keys
  set response_body = jsonb_build_object(
    'order',
    public.build_canonical_order(order_row)
  )
  where order_id = order_id_input;
end;
$$;

create or replace function public.sync_order_idempotency_after_status_history_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.sync_order_idempotency_response_by_order_id(new.order_id);
  return new;
end;
$$;

drop trigger if exists order_status_history_sync_idempotency on public.order_status_history;

create trigger order_status_history_sync_idempotency
after insert on public.order_status_history
for each row
execute function public.sync_order_idempotency_after_status_history_change();

grant execute on function public.append_order_status_history(uuid, text, text, text) to anon, authenticated, service_role;
grant execute on function public.sync_order_idempotency_response_by_order_id(uuid) to anon, authenticated, service_role;

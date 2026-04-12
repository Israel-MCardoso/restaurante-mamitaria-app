create table if not exists public.order_idempotency_keys (
  idempotency_key text primary key,
  request_hash text not null,
  order_id uuid references public.orders(id) on delete set null,
  response_body jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_order_idempotency_keys_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists order_idempotency_keys_touch_updated_at on public.order_idempotency_keys;

create trigger order_idempotency_keys_touch_updated_at
before update on public.order_idempotency_keys
for each row
execute function public.touch_order_idempotency_keys_updated_at();

alter table public.order_items
  add column if not exists product_name text;

update public.order_items oi
set product_name = p.name
from public.products p
where oi.product_id = p.id
  and oi.product_name is null;

alter table public.order_items
  alter column product_name set not null;

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
    'created_at', order_row.created_at,
    'updated_at', order_row.updated_at
  );
$$;

create or replace function public.get_canonical_order(
  order_id_input uuid,
  request_access_token text
)
returns jsonb
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
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if request_access_token is null or trim(request_access_token) = '' then
    raise exception 'ORDER_ACCESS_DENIED';
  end if;

  if order_row.access_token <> trim(request_access_token) then
    raise exception 'ORDER_ACCESS_DENIED';
  end if;

  return jsonb_build_object(
    'order', public.build_canonical_order(order_row)
  );
end;
$$;

create or replace function public.update_order_payment_data(
  order_id_input uuid,
  payment_status_input text,
  payment_data_input jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
begin
  if payment_status_input not in ('unpaid', 'pending', 'paid', 'failed', 'expired') then
    raise exception 'INVALID_PAYMENT_STATUS';
  end if;

  update public.orders
  set
    payment_status = payment_status_input,
    payment_data = payment_data_input
  where id = order_id_input
  returning *
  into order_row;

  if order_row.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'order', public.build_canonical_order(order_row)
  );
end;
$$;

drop function if exists public.create_canonical_order(jsonb);

create or replace function public.create_canonical_order(
  payload jsonb,
  request_idempotency_key text,
  request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  restaurant_row public.restaurants%rowtype;
  created_order public.orders%rowtype;
  existing_order public.orders%rowtype;
  idempotency_record public.order_idempotency_keys%rowtype;
  item_payload jsonb;
  addon_payload jsonb;
  product_row public.products%rowtype;
  addon_row public.addons%rowtype;
  customer_payload jsonb;
  delivery_payload jsonb;
  notes_value text;
  request_restaurant_id uuid;
  request_restaurant_slug text;
  request_payment_method text;
  request_fulfillment_type text;
  item_quantity integer;
  addon_quantity integer;
  base_unit_price numeric(10,2);
  addon_total_per_unit numeric(10,2);
  item_unit_price numeric(10,2);
  item_subtotal numeric(10,2);
  running_subtotal numeric(10,2) := 0;
  delivery_fee_value numeric(10,2) := 0;
  discount_amount_value numeric(10,2) := 0;
  total_amount_value numeric(10,2) := 0;
  min_order_value numeric(10,2) := 0;
  estimated_time_value integer := 45;
  generated_order_number text;
  item_response_json jsonb;
  order_response jsonb;
begin
  if payload is null then
    raise exception 'INVALID_REQUEST';
  end if;

  if request_idempotency_key is null or length(trim(request_idempotency_key)) = 0 then
    raise exception 'MISSING_IDEMPOTENCY_KEY';
  end if;

  if request_hash is null or length(trim(request_hash)) = 0 then
    raise exception 'MISSING_REQUEST_HASH';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(request_idempotency_key, 0));

  select *
  into idempotency_record
  from public.order_idempotency_keys
  where idempotency_key = request_idempotency_key;

  if found then
    if idempotency_record.order_id is not null then
      select *
      into existing_order
      from public.orders
      where id = idempotency_record.order_id;
    end if;

    if idempotency_record.request_hash <> request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD';
    end if;

    if idempotency_record.response_body is not null then
      return jsonb_build_object(
        'order', idempotency_record.response_body->'order',
        'idempotent_replay', true,
        'access_token', existing_order.access_token
      );
    end if;
  else
    insert into public.order_idempotency_keys (
      idempotency_key,
      request_hash
    )
    values (
      request_idempotency_key,
      request_hash
    );
  end if;

  request_restaurant_slug := nullif(trim(coalesce(payload->>'restaurant_slug', '')), '');

  if coalesce(payload->>'restaurant_id', '') <> '' then
    request_restaurant_id := (payload->>'restaurant_id')::uuid;
  else
    request_restaurant_id := null;
  end if;

  if request_restaurant_id is not null then
    select *
    into restaurant_row
    from public.restaurants
    where id = request_restaurant_id;
  elsif request_restaurant_slug is not null then
    select *
    into restaurant_row
    from public.restaurants
    where slug = request_restaurant_slug;
  end if;

  if restaurant_row.id is null then
    raise exception 'RESTAURANT_NOT_FOUND';
  end if;

  if coalesce(restaurant_row.is_active, false) is false then
    raise exception 'RESTAURANT_INACTIVE';
  end if;

  customer_payload := payload->'customer';
  delivery_payload := payload->'delivery_address';
  request_payment_method := payload->>'payment_method';
  request_fulfillment_type := payload->>'fulfillment_type';
  notes_value := nullif(trim(coalesce(payload->>'notes', '')), '');

  if request_fulfillment_type = 'delivery' and delivery_payload is null then
    raise exception 'DELIVERY_ADDRESS_REQUIRED';
  end if;

  if jsonb_typeof(payload->'items') <> 'array' or jsonb_array_length(payload->'items') = 0 then
    raise exception 'INVALID_ITEMS';
  end if;

  delivery_fee_value := case
    when request_fulfillment_type = 'delivery' then coalesce((restaurant_row.settings->>'delivery_fee')::numeric, 0)
    else 0
  end;

  min_order_value := coalesce((restaurant_row.settings->>'min_order')::numeric, 0);
  estimated_time_value := coalesce((restaurant_row.settings->>'estimated_time_minutes')::integer, 45);

  insert into public.orders (
    restaurant_id,
    customer_name,
    customer_phone,
    delivery_address,
    total_amount,
    delivery_fee,
    status,
    payment_method,
    payment_status,
    notes,
    order_number,
    subtotal,
    discount_amount,
    estimated_time_minutes,
    fulfillment_type,
    payment_data
  )
  values (
    restaurant_row.id,
    customer_payload->>'name',
    customer_payload->>'phone',
    case
      when request_fulfillment_type = 'delivery' then delivery_payload
      else null
    end,
    0,
    delivery_fee_value,
    'pending',
    request_payment_method,
    case
      when request_payment_method = 'pix' then 'pending'
      else 'unpaid'
    end,
    notes_value,
    'PENDING',
    0,
    discount_amount_value,
    estimated_time_value,
    request_fulfillment_type::fulfillment_type,
    null
  )
  returning *
  into created_order;

  generated_order_number := 'ORD-' || lpad(nextval('order_number_seq')::text, 6, '0');

  for item_payload in
    select value
    from jsonb_array_elements(payload->'items')
  loop
    select *
    into product_row
    from public.products
    where id = (item_payload->>'product_id')::uuid
      and restaurant_id = restaurant_row.id;

    if product_row.id is null then
      raise exception 'PRODUCT_NOT_FOUND';
    end if;

    if coalesce(product_row.is_available, false) is false then
      raise exception 'PRODUCT_UNAVAILABLE';
    end if;

    item_quantity := greatest(coalesce((item_payload->>'quantity')::integer, 0), 0);

    if item_quantity <= 0 then
      raise exception 'INVALID_ITEM_QUANTITY';
    end if;

    base_unit_price := coalesce(product_row.promo_price, product_row.price);
    addon_total_per_unit := 0;
    item_response_json := '[]'::jsonb;

    if item_payload ? 'addons' and jsonb_typeof(item_payload->'addons') = 'array' then
      for addon_payload in
        select value
        from jsonb_array_elements(item_payload->'addons')
      loop
        addon_quantity := greatest(coalesce((addon_payload->>'quantity')::integer, 0), 0);

        if addon_quantity <= 0 then
          raise exception 'INVALID_ADDON_QUANTITY';
        end if;

        select *
        into addon_row
        from public.addons
        where id = (addon_payload->>'addon_id')::uuid
          and restaurant_id = restaurant_row.id;

        if addon_row.id is null then
          raise exception 'ADDON_NOT_FOUND';
        end if;

        if coalesce(addon_row.is_available, false) is false then
          raise exception 'ADDON_UNAVAILABLE';
        end if;

        if not exists (
          select 1
          from public.product_addons
          where product_id = product_row.id
            and addon_id = addon_row.id
        ) then
          raise exception 'ADDON_NOT_ALLOWED';
        end if;

        addon_total_per_unit := addon_total_per_unit + (addon_row.price * addon_quantity);
        item_response_json := item_response_json || jsonb_build_array(
          jsonb_build_object(
            'addon_id', addon_row.id,
            'name', addon_row.name,
            'quantity', addon_quantity,
            'unit_price', addon_row.price,
            'total_price', (addon_row.price * addon_quantity * item_quantity)
          )
        );
      end loop;
    end if;

    item_unit_price := base_unit_price + addon_total_per_unit;
    item_subtotal := item_unit_price * item_quantity;
    running_subtotal := running_subtotal + item_subtotal;

    insert into public.order_items (
      order_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      subtotal,
      observations,
      addons_json
    )
    values (
      created_order.id,
      product_row.id,
      product_row.name,
      item_quantity,
      item_unit_price,
      item_subtotal,
      nullif(trim(coalesce(item_payload->>'notes', '')), ''),
      item_response_json
    );
  end loop;

  if running_subtotal < min_order_value then
    raise exception 'MINIMUM_ORDER_NOT_REACHED';
  end if;

  total_amount_value := running_subtotal + delivery_fee_value - discount_amount_value;

  update public.orders
  set
    subtotal = running_subtotal,
    total_amount = total_amount_value,
    order_number = generated_order_number
  where id = created_order.id
  returning *
  into created_order;

  order_response := jsonb_build_object(
    'order',
    public.build_canonical_order(created_order)
  );

  update public.order_idempotency_keys
  set
    order_id = created_order.id,
    response_body = order_response
  where idempotency_key = request_idempotency_key;

  return jsonb_build_object(
    'order', order_response->'order',
    'idempotent_replay', false,
    'access_token', created_order.access_token
  );
exception
  when others then
    delete from public.order_idempotency_keys
    where idempotency_key = request_idempotency_key
      and response_body is null;
    raise;
end;
$$;

grant execute on function public.create_canonical_order(jsonb, text, text) to anon, authenticated, service_role;
grant execute on function public.get_canonical_order(uuid, text) to anon, authenticated, service_role;
grant execute on function public.update_order_payment_data(uuid, text, jsonb) to anon, authenticated, service_role;

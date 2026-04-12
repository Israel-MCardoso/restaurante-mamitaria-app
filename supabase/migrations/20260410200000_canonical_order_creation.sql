create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'fulfillment_type'
  ) then
    create type fulfillment_type as enum ('delivery', 'pickup');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_class
    where relkind = 'S'
      and relname = 'order_number_seq'
  ) then
    create sequence order_number_seq start 1000;
  end if;
end $$;

alter table public.orders
  add column if not exists order_number text,
  add column if not exists subtotal decimal(10,2),
  add column if not exists discount_amount decimal(10,2) not null default 0,
  add column if not exists estimated_time_minutes integer,
  add column if not exists fulfillment_type fulfillment_type,
  add column if not exists payment_data jsonb,
  add column if not exists updated_at timestamptz not null default now();

update public.orders
set
  subtotal = coalesce(subtotal, greatest(total_amount - coalesce(delivery_fee, 0), 0)),
  discount_amount = coalesce(discount_amount, 0),
  estimated_time_minutes = coalesce(estimated_time_minutes, 45),
  fulfillment_type = coalesce(fulfillment_type, 'delivery'::fulfillment_type),
  payment_data = coalesce(payment_data, null),
  order_number = coalesce(order_number, 'ORD-' || lpad(nextval('order_number_seq')::text, 6, '0')),
  updated_at = coalesce(updated_at, created_at, now());

alter table public.orders
  alter column subtotal set not null,
  alter column fulfillment_type set not null,
  alter column order_number set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_order_number_key'
  ) then
    alter table public.orders
      add constraint orders_order_number_key unique (order_number);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_payment_status_check'
  ) then
    alter table public.orders
      add constraint orders_payment_status_check
      check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'expired'));
  end if;
end $$;

create or replace function public.touch_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_touch_updated_at on public.orders;

create trigger orders_touch_updated_at
before update on public.orders
for each row
execute function public.touch_orders_updated_at();

create or replace function public.create_canonical_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  restaurant_row public.restaurants%rowtype;
  created_order public.orders%rowtype;
  item_payload jsonb;
  addon_payload jsonb;
  product_row public.products%rowtype;
  addon_row public.addons%rowtype;
  customer_payload jsonb;
  delivery_payload jsonb;
  notes_value text;
  coupon_code_value text;
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
  order_items_json jsonb := '[]'::jsonb;
  item_addons_json jsonb;
  line_addons jsonb;
begin
  if payload is null then
    raise exception 'INVALID_REQUEST';
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
  coupon_code_value := nullif(trim(coalesce(payload->>'coupon_code', '')), '');

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
    line_addons := '[]'::jsonb;

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
        line_addons := line_addons || jsonb_build_array(
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

    order_items_json := order_items_json || jsonb_build_array(
      jsonb_build_object(
        'item_id', gen_random_uuid(),
        'product_id', product_row.id,
        'product_name', product_row.name,
        'quantity', item_quantity,
        'unit_price', item_unit_price,
        'subtotal', item_subtotal,
        'notes', nullif(trim(coalesce(item_payload->>'notes', '')), ''),
        'addons', line_addons
      )
    );
  end loop;

  if running_subtotal < min_order_value then
    raise exception 'MINIMUM_ORDER_NOT_REACHED';
  end if;

  total_amount_value := running_subtotal + delivery_fee_value - discount_amount_value;
  generated_order_number := 'ORD-' || lpad(nextval('order_number_seq')::text, 6, '0');

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
    total_amount_value,
    delivery_fee_value,
    'pending',
    request_payment_method,
    case
      when request_payment_method = 'pix' then 'pending'
      else 'unpaid'
    end,
    notes_value,
    generated_order_number,
    running_subtotal,
    discount_amount_value,
    estimated_time_value,
    request_fulfillment_type::fulfillment_type,
    null
  )
  returning *
  into created_order;

  for item_addons_json in
    select value
    from jsonb_array_elements(order_items_json)
  loop
    insert into public.order_items (
      order_id,
      product_id,
      quantity,
      unit_price,
      subtotal,
      observations,
      addons_json
    )
    values (
      created_order.id,
      (item_addons_json->>'product_id')::uuid,
      (item_addons_json->>'quantity')::integer,
      (item_addons_json->>'unit_price')::numeric,
      (item_addons_json->>'subtotal')::numeric,
      item_addons_json->>'notes',
      item_addons_json->'addons'
    );
  end loop;

  return jsonb_build_object(
    'order',
    jsonb_build_object(
      'order_id', created_order.id,
      'order_number', created_order.order_number,
      'status', created_order.status,
      'payment_method', created_order.payment_method,
      'payment_status', created_order.payment_status,
      'subtotal', created_order.subtotal,
      'delivery_fee', created_order.delivery_fee,
      'discount_amount', created_order.discount_amount,
      'total_amount', created_order.total_amount,
      'estimated_time_minutes', created_order.estimated_time_minutes,
      'fulfillment_type', created_order.fulfillment_type,
      'items', order_items_json,
      'payment_data', created_order.payment_data,
      'customer', jsonb_build_object(
        'name', created_order.customer_name,
        'phone', created_order.customer_phone
      ),
      'delivery_address', created_order.delivery_address,
      'created_at', created_order.created_at,
      'updated_at', created_order.updated_at
    )
  );
end;
$$;

grant execute on function public.create_canonical_order(jsonb) to anon, authenticated, service_role;

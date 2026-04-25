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
  option_payload jsonb;
  product_row public.products%rowtype;
  addon_row public.addons%rowtype;
  coupon_row public.coupons%rowtype;
  option_group_row public.product_options%rowtype;
  option_item_row public.product_option_items%rowtype;
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
  option_selection_count integer;
  override_group_count integer;
  base_unit_price numeric(10,2);
  override_base_unit_price numeric(10,2);
  addon_total_per_unit numeric(10,2);
  option_total_per_unit numeric(10,2);
  item_unit_price numeric(10,2);
  item_subtotal numeric(10,2);
  running_subtotal numeric(10,2) := 0;
  delivery_fee_value numeric(10,2) := 0;
  delivery_fee_override_value numeric(10,2) := null;
  discount_amount_value numeric(10,2) := 0;
  discount_amount_override_value numeric(10,2) := null;
  total_amount_value numeric(10,2) := 0;
  min_order_value numeric(10,2) := 0;
  estimated_time_value integer := 45;
  generated_order_number text;
  line_addons jsonb;
  line_options jsonb;
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
  coupon_code_value := nullif(trim(coalesce(payload->>'coupon_code', '')), '');

  if coalesce(payload->>'restaurant_id', '') <> '' then
    request_restaurant_id := (payload->>'restaurant_id')::uuid;
  else
    request_restaurant_id := null;
  end if;

  if nullif(trim(coalesce(payload->>'delivery_fee_override', '')), '') is not null then
    delivery_fee_override_value := greatest((payload->>'delivery_fee_override')::numeric, 0);
  end if;

  if nullif(trim(coalesce(payload->>'discount_amount_override', '')), '') is not null then
    discount_amount_override_value := greatest((payload->>'discount_amount_override')::numeric, 0);
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
    when request_fulfillment_type = 'delivery' then coalesce(delivery_fee_override_value, coalesce((restaurant_row.settings->>'delivery_fee')::numeric, 0))
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
      when request_payment_method in ('pix', 'card') then 'pending'
      else 'unpaid'
    end,
    notes_value,
    'PENDING',
    0,
    0,
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

    select count(*)
    into override_group_count
    from public.product_options po
    where po.product_id = product_row.id
      and (
        coalesce(po.is_price_override, false)
        or lower(translate(trim(po.name), 'ÃÃ€Ã‚ÃƒÃ„Ã‰ÃˆÃŠÃ‹ÃÃŒÃŽÃÃ“Ã’Ã”Ã•Ã–ÃšÃ™Ã›ÃœÃ‡Ã¡Ã Ã¢Ã£Ã¤Ã©Ã¨ÃªÃ«Ã­Ã¬Ã®Ã¯Ã³Ã²Ã´ÃµÃ¶ÃºÃ¹Ã»Ã¼Ã§', 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')) like '%tamanho%'
      );

    if override_group_count > 1 then
      raise exception 'PRODUCT_OPTION_PRICE_OVERRIDE_CONFLICT';
    end if;

    base_unit_price := coalesce(product_row.promo_price, product_row.price);
    override_base_unit_price := null;
    addon_total_per_unit := 0;
    option_total_per_unit := 0;
    line_addons := '[]'::jsonb;
    line_options := '[]'::jsonb;

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

    if item_payload ? 'options' and jsonb_typeof(item_payload->'options') = 'array' then
      for option_payload in
        select value
        from jsonb_array_elements(item_payload->'options')
      loop
        select *
        into option_group_row
        from public.product_options
        where id = (option_payload->>'option_id')::uuid
          and product_id = product_row.id;

        if option_group_row.id is null then
          raise exception 'PRODUCT_OPTION_NOT_ALLOWED';
        end if;

        select *
        into option_item_row
        from public.product_option_items
        where id = (option_payload->>'option_item_id')::uuid
          and option_id = option_group_row.id;

        if option_item_row.id is null then
          raise exception 'PRODUCT_OPTION_ITEM_NOT_FOUND';
        end if;

        if coalesce(option_item_row.is_available, false) is false then
          raise exception 'PRODUCT_OPTION_ITEM_UNAVAILABLE';
        end if;

        if coalesce(option_group_row.is_price_override, false)
          or lower(translate(trim(option_group_row.name), 'ÃÃ€Ã‚ÃƒÃ„Ã‰ÃˆÃŠÃ‹ÃÃŒÃŽÃÃ“Ã’Ã”Ã•Ã–ÃšÃ™Ã›ÃœÃ‡Ã¡Ã Ã¢Ã£Ã¤Ã©Ã¨ÃªÃ«Ã­Ã¬Ã®Ã¯Ã³Ã²Ã´ÃµÃ¶ÃºÃ¹Ã»Ã¼Ã§', 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')) like '%tamanho%' then
          if override_base_unit_price is not null then
            raise exception 'PRODUCT_OPTION_PRICE_OVERRIDE_CONFLICT';
          end if;

          override_base_unit_price := option_item_row.price_adjustment;
        else
          option_total_per_unit := option_total_per_unit + option_item_row.price_adjustment;
        end if;

        line_options := line_options || jsonb_build_array(
          jsonb_build_object(
            'option_id', option_group_row.id,
            'option_name', option_group_row.name,
            'option_item_id', option_item_row.id,
            'option_item_name', option_item_row.name,
            'price_adjustment', option_item_row.price_adjustment,
            'is_price_override', coalesce(option_group_row.is_price_override, false)
          )
        );
      end loop;
    end if;

    for option_group_row in
      select *
      from public.product_options
      where product_id = product_row.id
      order by position asc, created_at asc
    loop
      select count(*)
      into option_selection_count
      from jsonb_array_elements(line_options) selected_option
      where selected_option->>'option_id' = option_group_row.id::text;

      if option_selection_count < greatest(coalesce(option_group_row.min_select, 0), 0)
        or option_selection_count > greatest(coalesce(option_group_row.max_select, option_group_row.min_select), coalesce(option_group_row.min_select, 0)) then
        raise exception 'PRODUCT_OPTION_REQUIRED';
      end if;
    end loop;

    item_unit_price := coalesce(override_base_unit_price, base_unit_price) + addon_total_per_unit + option_total_per_unit;
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
      addons_json,
      options_json
    )
    values (
      created_order.id,
      product_row.id,
      product_row.name,
      item_quantity,
      item_unit_price,
      item_subtotal,
      nullif(trim(coalesce(item_payload->>'notes', '')), ''),
      line_addons,
      line_options
    );
  end loop;

  if running_subtotal < min_order_value then
    raise exception 'MINIMUM_ORDER_NOT_REACHED';
  end if;

  if discount_amount_override_value is not null then
    discount_amount_value := least(running_subtotal, discount_amount_override_value);
  elsif coupon_code_value is not null then
    select *
    into coupon_row
    from public.coupons
    where restaurant_id = restaurant_row.id
      and upper(code) = upper(coupon_code_value)
    limit 1;

    if coupon_row.id is null then
      raise exception 'COUPON_NOT_FOUND';
    end if;

    if coalesce(coupon_row.is_active, false) is false then
      raise exception 'COUPON_INACTIVE';
    end if;

    if coupon_row.expires_at is not null and coupon_row.expires_at <= now() then
      raise exception 'COUPON_EXPIRED';
    end if;

    if coupon_row.max_uses is not null and coalesce(coupon_row.used_count, 0) >= coupon_row.max_uses then
      raise exception 'COUPON_LIMIT_REACHED';
    end if;

    if running_subtotal < coalesce(coupon_row.min_order_value, 0) then
      raise exception 'COUPON_MIN_ORDER_NOT_REACHED';
    end if;

    discount_amount_value := least(
      running_subtotal,
      case
        when coupon_row.discount_type = 'percentage' then round(running_subtotal * (coupon_row.discount_value / 100.0), 2)
        else coalesce(coupon_row.discount_value, 0)
      end
    );
  end if;

  total_amount_value := greatest(running_subtotal + delivery_fee_value - discount_amount_value, 0);

  update public.orders
  set
    subtotal = running_subtotal,
    total_amount = total_amount_value,
    discount_amount = discount_amount_value,
    delivery_fee = delivery_fee_value,
    order_number = generated_order_number
  where id = created_order.id
  returning *
  into created_order;

  if coupon_row.id is not null and discount_amount_value > 0 then
    update public.coupons
    set used_count = coalesce(used_count, 0) + 1
    where id = coupon_row.id;
  end if;

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

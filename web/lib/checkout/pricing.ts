import { ApiError } from '@/lib/api/errors';
import type { CreateOrderRequest } from '@/lib/contracts';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

export type QuoteRequest = Pick<
  CreateOrderRequest,
  'restaurant_id' | 'restaurant_slug' | 'fulfillment_type' | 'delivery_address' | 'items' | 'coupon_code'
>;

export interface OrderQuote {
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  totalAmount: number;
  estimatedTimeMinutes: number;
  coupon: {
    code: string | null;
    applied: boolean;
    message: string | null;
  };
  delivery: {
    mode: 'fixed' | 'distance';
    resolvedMode: 'fixed' | 'distance';
    distanceKm: number | null;
    message: string | null;
  };
}

type DeliveryQuote = {
  mode: 'fixed' | 'distance';
  resolvedMode: 'fixed' | 'distance';
  distanceKm: number | null;
  message: string | null;
  fee: number;
};

type RestaurantRow = {
  id: string;
  slug: string;
  is_active: boolean | null;
  address: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
};

type ProductRow = {
  id: string;
  restaurant_id: string;
  name: string;
  price: number | string;
  promo_price: number | string | null;
  is_available: boolean | null;
};

type AddonRow = {
  id: string;
  restaurant_id: string;
  name: string;
  price: number | string;
  is_available: boolean | null;
};

type ProductOptionRow = {
  id: string;
  product_id: string;
  name: string;
  min_select: number | null;
  max_select: number | null;
};

type ProductOptionItemRow = {
  id: string;
  option_id: string;
  name: string;
  price_adjustment: number | string;
  is_available: boolean | null;
};

type CouponRow = {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number | string;
  min_order_value: number | string | null;
  max_uses: number | null;
  used_count: number | null;
  expires_at: string | null;
  is_active: boolean | null;
};

const GEOCODING_USER_AGENT =
  process.env.OSM_GEOCODING_USER_AGENT ??
  'familia-mineira-admin/1.0 (contato@evocore.app)';

export async function calculateOrderQuote(
  payload: QuoteRequest,
  options: { strictCoupon?: boolean } = {},
): Promise<OrderQuote> {
  const supabase = getSupabaseAdminClient();
  const restaurant = await loadRestaurant(payload, supabase);
  const settings = normalizeRestaurantSettings(restaurant.settings);

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new ApiError(400, 'INVALID_ITEMS', 'Order must include at least one valid item.', 'items');
  }

  const productIds = payload.items.map((item) => item.product_id);
  const { data: productsData, error: productsError } = await (supabase as any)
    .from('products')
    .select('id, restaurant_id, name, price, promo_price, is_available')
    .in('id', productIds)
    .eq('restaurant_id', restaurant.id);

  if (productsError) {
    throw new ApiError(500, 'QUOTE_PRODUCTS_FAILED', 'Nao foi possivel validar os produtos agora.');
  }

  const products = new Map<string, ProductRow>(
    ((productsData ?? []) as ProductRow[]).map((product) => [product.id, product]),
  );

  const addonIds = payload.items.flatMap((item) => (item.addons ?? []).map((addon) => addon.addon_id));
  const uniqueAddonIds = [...new Set(addonIds)];
  const optionItemIds = payload.items.flatMap((item) => (item.options ?? []).map((option) => option.option_item_id));
  const uniqueOptionItemIds = [...new Set(optionItemIds)];

  const productAddonPairs = new Set<string>();

  if (productIds.length > 0 && uniqueAddonIds.length > 0) {
    const { data: productAddonsData, error: productAddonsError } = await (supabase as any)
      .from('product_addons')
      .select('product_id, addon_id')
      .in('product_id', productIds)
      .in('addon_id', uniqueAddonIds);

    if (productAddonsError) {
      throw new ApiError(500, 'QUOTE_ADDONS_FAILED', 'Nao foi possivel validar os adicionais agora.');
    }

    for (const row of (productAddonsData ?? []) as Array<{ product_id: string; addon_id: string }>) {
      productAddonPairs.add(`${row.product_id}:${row.addon_id}`);
    }
  }

  const addons = new Map<string, AddonRow>();
  const productOptions = new Map<string, ProductOptionRow[]>();
  const optionItems = new Map<string, ProductOptionItemRow>();

  if (uniqueAddonIds.length > 0) {
    const { data: addonsData, error: addonsError } = await (supabase as any)
      .from('addons')
      .select('id, restaurant_id, name, price, is_available')
      .in('id', uniqueAddonIds)
      .eq('restaurant_id', restaurant.id);

    if (addonsError) {
      throw new ApiError(500, 'QUOTE_ADDONS_FAILED', 'Nao foi possivel validar os adicionais agora.');
    }

    for (const addon of (addonsData ?? []) as AddonRow[]) {
      addons.set(addon.id, addon);
    }
  }

  if (productIds.length > 0) {
    const { data: productOptionsData, error: productOptionsError } = await (supabase as any)
      .from('product_options')
      .select('id, product_id, name, min_select, max_select')
      .in('product_id', productIds);

    if (productOptionsError) {
      throw new ApiError(500, 'QUOTE_PRODUCT_OPTIONS_FAILED', 'Nao foi possivel validar as opcoes do produto agora.');
    }

    for (const option of (productOptionsData ?? []) as ProductOptionRow[]) {
      const currentOptions = productOptions.get(option.product_id) ?? [];
      currentOptions.push(option);
      productOptions.set(option.product_id, currentOptions);
    }
  }

  if (uniqueOptionItemIds.length > 0) {
    const { data: optionItemsData, error: optionItemsError } = await (supabase as any)
      .from('product_option_items')
      .select('id, option_id, name, price_adjustment, is_available')
      .in('id', uniqueOptionItemIds);

    if (optionItemsError) {
      throw new ApiError(500, 'QUOTE_PRODUCT_OPTIONS_FAILED', 'Nao foi possivel validar as opcoes do produto agora.');
    }

    for (const optionItem of (optionItemsData ?? []) as ProductOptionItemRow[]) {
      optionItems.set(optionItem.id, optionItem);
    }
  }

  let subtotal = 0;

  for (const item of payload.items) {
    const product = products.get(item.product_id);

    if (!product) {
      throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'One or more selected products no longer exist.', 'items');
    }

    if (!product.is_available) {
      throw new ApiError(409, 'PRODUCT_UNAVAILABLE', 'One or more selected products are unavailable.', 'items');
    }

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new ApiError(400, 'INVALID_ITEM_QUANTITY', 'One or more items have an invalid quantity.', 'items');
    }

    const basePrice = toMoney(product.promo_price ?? product.price);
    let addonPerUnit = 0;
    let optionPerUnit = 0;
    const productOptionGroups = productOptions.get(item.product_id) ?? [];
    const productOptionGroupIds = new Set(productOptionGroups.map((option) => option.id));
    const selectedOptionCounts = new Map<string, number>();

    for (const addonSelection of item.addons ?? []) {
      if (!Number.isInteger(addonSelection.quantity) || addonSelection.quantity <= 0) {
        throw new ApiError(400, 'INVALID_ADDON_QUANTITY', 'One or more addons have an invalid quantity.', 'items');
      }

      const addon = addons.get(addonSelection.addon_id);

      if (!addon) {
        throw new ApiError(404, 'ADDON_NOT_FOUND', 'One or more selected addons no longer exist.', 'items');
      }

      if (!addon.is_available) {
        throw new ApiError(409, 'ADDON_UNAVAILABLE', 'One or more selected addons are unavailable.', 'items');
      }

      if (!productAddonPairs.has(`${item.product_id}:${addonSelection.addon_id}`)) {
        throw new ApiError(409, 'ADDON_NOT_ALLOWED', 'One or more selected addons are not allowed for the chosen product.', 'items');
      }

      addonPerUnit += toMoney(addon.price) * addonSelection.quantity;
    }

    for (const optionSelection of item.options ?? []) {
      if (!productOptionGroupIds.has(optionSelection.option_id)) {
        throw new ApiError(409, 'PRODUCT_OPTION_NOT_ALLOWED', 'One or more required product options are invalid.', 'items');
      }

      const optionItem = optionItems.get(optionSelection.option_item_id);

      if (!optionItem) {
        throw new ApiError(404, 'PRODUCT_OPTION_ITEM_NOT_FOUND', 'One or more required product options no longer exist.', 'items');
      }

      if (!optionItem.is_available) {
        throw new ApiError(409, 'PRODUCT_OPTION_ITEM_UNAVAILABLE', 'One or more required product options are unavailable.', 'items');
      }

      if (optionItem.option_id !== optionSelection.option_id) {
        throw new ApiError(409, 'PRODUCT_OPTION_NOT_ALLOWED', 'One or more required product options are invalid.', 'items');
      }

      optionPerUnit += toMoney(optionItem.price_adjustment);
      selectedOptionCounts.set(optionSelection.option_id, (selectedOptionCounts.get(optionSelection.option_id) ?? 0) + 1);
    }

    for (const optionGroup of productOptionGroups) {
      const selectedCount = selectedOptionCounts.get(optionGroup.id) ?? 0;
      const minSelect = Math.max(0, Number(optionGroup.min_select ?? 0));
      const maxSelect = Math.max(minSelect, Number(optionGroup.max_select ?? minSelect));

      if (selectedCount < minSelect || selectedCount > maxSelect) {
        throw new ApiError(409, 'PRODUCT_OPTION_REQUIRED', 'One or more required product options are missing.', 'items');
      }
    }

    subtotal += (basePrice + addonPerUnit + optionPerUnit) * item.quantity;
  }

  if (subtotal < settings.minOrder) {
    throw new ApiError(409, 'MINIMUM_ORDER_NOT_REACHED', 'Seu pedido ainda nao atingiu o valor minimo da loja.');
  }

  const deliveryQuote =
    payload.fulfillment_type === 'delivery'
      ? await calculateDeliveryQuote(restaurant, settings, payload.delivery_address)
      : {
          mode: settings.deliveryPricingMode,
          resolvedMode: 'fixed' as const,
          distanceKm: null,
          message: null,
          fee: 0,
        };

  const couponQuote = await resolveCouponQuote(
    supabase,
    restaurant.id,
    payload.coupon_code ?? null,
    subtotal,
    Boolean(options.strictCoupon),
  );

  const totalAmount = roundMoney(Math.max(0, subtotal + deliveryQuote.fee - couponQuote.discountAmount));

  return {
    subtotal: roundMoney(subtotal),
    deliveryFee: roundMoney(deliveryQuote.fee),
    discountAmount: roundMoney(couponQuote.discountAmount),
    totalAmount,
    estimatedTimeMinutes: settings.estimatedTimeMinutes,
    coupon: {
      code: couponQuote.code,
      applied: couponQuote.applied,
      message: couponQuote.message,
    },
    delivery: {
      mode: deliveryQuote.mode,
      resolvedMode: deliveryQuote.resolvedMode,
      distanceKm: deliveryQuote.distanceKm,
      message: deliveryQuote.message,
    },
  };
}

async function loadRestaurant(payload: QuoteRequest, supabase: ReturnType<typeof getSupabaseAdminClient>) {
  if (!payload.restaurant_id && !payload.restaurant_slug) {
    throw new ApiError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found.', 'restaurant_id');
  }

  let query = (supabase as any)
    .from('restaurants')
    .select('id, slug, is_active, address, settings')
    .limit(1);

  query = payload.restaurant_id
    ? query.eq('id', payload.restaurant_id)
    : query.eq('slug', payload.restaurant_slug);

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new ApiError(500, 'RESTAURANT_LOOKUP_FAILED', 'Nao foi possivel carregar o restaurante agora.');
  }

  if (!data) {
    throw new ApiError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found.', 'restaurant_id');
  }

  const restaurant = data as RestaurantRow;

  if (!restaurant.is_active) {
    throw new ApiError(409, 'RESTAURANT_INACTIVE', 'Restaurant is not accepting orders right now.');
  }

  return restaurant;
}

function normalizeRestaurantSettings(settings: Record<string, unknown> | null) {
  const source = settings ?? {};

  return {
    deliveryFee: toMoney(source.delivery_fee),
    minOrder: toMoney(source.min_order),
    estimatedTimeMinutes: toInteger(source.estimated_time_minutes, 45),
    deliveryPricingMode: (source.delivery_pricing_mode === 'distance' ? 'distance' : 'fixed') as 'fixed' | 'distance',
    deliveryFeePerKm: toMoney(source.delivery_fee_per_km),
  };
}

async function calculateDeliveryQuote(
  restaurant: RestaurantRow,
  settings: ReturnType<typeof normalizeRestaurantSettings>,
  deliveryAddress: QuoteRequest['delivery_address'],
): Promise<DeliveryQuote> {
  const fixedFee = settings.deliveryFee;

  if (settings.deliveryPricingMode !== 'distance') {
    return {
      mode: settings.deliveryPricingMode,
      resolvedMode: 'fixed' as const,
      distanceKm: null,
      message: null,
      fee: fixedFee,
    };
  }

  const restaurantAddress = formatAddressForGeocoding(restaurant.address);
  const customerAddress = formatAddressForGeocoding(deliveryAddress as unknown as Record<string, unknown> | null);

  if (!restaurantAddress || !customerAddress) {
    return {
      mode: 'distance' as const,
      resolvedMode: 'fixed' as const,
      distanceKm: null,
      message: 'Taxa de entrega estimada com valor base da loja.',
      fee: fixedFee,
    };
  }

  const [restaurantCoords, customerCoords] = await Promise.all([
    geocodeAddress(restaurantAddress),
    geocodeAddress(customerAddress),
  ]);

  if (!restaurantCoords || !customerCoords) {
    return {
      mode: 'distance' as const,
      resolvedMode: 'fixed' as const,
      distanceKm: null,
      message: 'Nao foi possivel estimar a distancia agora. Usando a taxa base da loja.',
      fee: fixedFee,
    };
  }

  const distanceKm = await routeDistanceKm(restaurantCoords, customerCoords);

  if (distanceKm === null) {
    return {
      mode: 'distance' as const,
      resolvedMode: 'fixed' as const,
      distanceKm: null,
      message: 'Nao foi possivel calcular a rota agora. Usando a taxa base da loja.',
      fee: fixedFee,
    };
  }

  const distanceFee = fixedFee + distanceKm * settings.deliveryFeePerKm;

  return {
    mode: 'distance' as const,
    resolvedMode: 'distance' as const,
    distanceKm: roundMoney(distanceKm),
    message: null,
    fee: roundMoney(distanceFee),
  };
}

async function resolveCouponQuote(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  restaurantId: string,
  couponCode: string | null,
  subtotal: number,
  strict: boolean,
) {
  const normalizedCode = couponCode?.trim().toUpperCase() ?? null;

  if (!normalizedCode) {
    return {
      code: null,
      applied: false,
      message: null,
      discountAmount: 0,
    };
  }

  const { data, error } = await (supabase as any)
    .from('coupons')
    .select('id, code, discount_type, discount_value, min_order_value, max_uses, used_count, expires_at, is_active')
    .eq('restaurant_id', restaurantId)
    .eq('code', normalizedCode)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, 'COUPON_LOOKUP_FAILED', 'Nao foi possivel validar o cupom agora.');
  }

  const coupon = data as CouponRow | null;

  if (!coupon) {
    if (strict) {
      throw new ApiError(404, 'COUPON_NOT_FOUND', 'Cupom nao encontrado.', 'coupon_code');
    }

    return {
      code: normalizedCode,
      applied: false,
      message: 'Cupom nao encontrado.',
      discountAmount: 0,
    };
  }

  if (!coupon.is_active) {
    return handleCouponFailure(strict, 'COUPON_INACTIVE', 'Este cupom nao esta ativo no momento.', normalizedCode);
  }

  if (coupon.expires_at && new Date(coupon.expires_at).getTime() <= Date.now()) {
    return handleCouponFailure(strict, 'COUPON_EXPIRED', 'Este cupom expirou.', normalizedCode);
  }

  if (coupon.max_uses !== null && (coupon.used_count ?? 0) >= coupon.max_uses) {
    return handleCouponFailure(strict, 'COUPON_LIMIT_REACHED', 'Este cupom atingiu o limite de uso.', normalizedCode);
  }

  const couponMinOrder = toMoney(coupon.min_order_value);

  if (subtotal < couponMinOrder) {
    return handleCouponFailure(
      strict,
      'COUPON_MIN_ORDER_NOT_REACHED',
      `Este cupom exige pedido minimo de ${formatMoney(couponMinOrder)}.`,
      normalizedCode,
    );
  }

  const rawDiscount =
    coupon.discount_type === 'percentage'
      ? subtotal * (toMoney(coupon.discount_value) / 100)
      : toMoney(coupon.discount_value);

  return {
    code: normalizedCode,
    applied: true,
    message: 'Cupom aplicado com sucesso.',
    discountAmount: roundMoney(Math.min(subtotal, rawDiscount)),
  };
}

function handleCouponFailure(strict: boolean, code: string, message: string, normalizedCode: string) {
  if (strict) {
    throw new ApiError(409, code, message, 'coupon_code');
  }

  return {
    code: normalizedCode,
    applied: false,
    message,
    discountAmount: 0,
  };
}

async function geocodeAddress(address: string) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(address)}`,
      {
        cache: 'no-store',
        headers: {
          'User-Agent': GEOCODING_USER_AGENT,
          Referer: 'https://familiamineira.app',
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as Array<{ lat?: string; lon?: string }>;
    const result = body[0];
    const lat = Number(result?.lat);
    const lng = Number(result?.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    return {
      lat,
      lng,
    };
  } catch {
    return null;
  }
}

async function routeDistanceKm(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
) {
  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=false`,
      { cache: 'no-store' },
    );

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as {
      code?: string;
      routes?: Array<{ distance?: number }>;
    };

    const distanceMeters = body.routes?.[0]?.distance;

    if (body.code !== 'Ok' || typeof distanceMeters !== 'number' || !Number.isFinite(distanceMeters)) {
      return null;
    }

    return distanceMeters / 1000;
  } catch {
    return null;
  }
}

function formatAddressForGeocoding(address: Record<string, unknown> | null) {
  if (!address) {
    return null;
  }

  const street = readString(address.street);
  const number = readString(address.number);
  const city = readString(address.city);

  if (!street || !number || !city) {
    return null;
  }

  return `${street}, ${number}, ${city}, Brasil`;
}

function toMoney(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

function toInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

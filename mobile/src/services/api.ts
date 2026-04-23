import { supabase } from '../lib/supabase';

export interface AdminCategory {
  id: string;
  restaurant_id: string;
  name: string;
  position: number | null;
  is_active: boolean | null;
  created_at?: string;
}

export interface AdminProduct {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description?: string | null;
  price: number;
  promo_price?: number | null;
  image_url?: string | null;
  is_available: boolean | null;
  created_at?: string;
  category?: {
    name?: string | null;
    is_active?: boolean | null;
  } | null;
}

export interface AdminAddon {
  id: string;
  restaurant_id: string;
  name: string;
  price: number;
  is_available?: boolean | null;
  created_at?: string;
}

export interface AdminProductOptionItem {
  id?: string;
  option_id?: string;
  name: string;
  price_adjustment: number;
  is_available?: boolean | null;
  position?: number | null;
}

export interface AdminProductOptionGroup {
  id?: string;
  product_id?: string;
  name: string;
  min_select: number;
  max_select: number;
  position?: number | null;
  items: AdminProductOptionItem[];
}

type AdminProductRelation = {
  name?: string | null;
  is_active?: boolean | null;
} | null;

type AdminProductRow = Omit<AdminProduct, 'category'> & {
  category?: AdminProductRelation | AdminProductRelation[];
  categories?: AdminProductRelation | AdminProductRelation[];
};

type ApiErrorLike = {
  message?: string;
};

function normalizeProductCategory(product: AdminProductRow): AdminProduct['category'] {
  const relation = product.category ?? product.categories ?? null;
  const normalizedRelation = Array.isArray(relation) ? relation[0] ?? null : relation;

  if (!normalizedRelation || typeof normalizedRelation !== 'object') {
    return null;
  }

  return {
    name: normalizedRelation.name ?? null,
    is_active: normalizedRelation.is_active ?? null,
  };
}

export interface AdminRestaurant {
  id: string;
  name: string;
  slug: string;
  phone?: string | null;
  address?: {
    street?: string;
    number?: string;
    city?: string;
  } | null;
  logo_url?: string | null;
  banner_url?: string | null;
  is_active?: boolean | null;
  settings?: {
    delivery_fee?: number | string | null;
    min_order?: number | string | null;
    estimated_time_minutes?: number | string | null;
    delivery_pricing_mode?: 'fixed' | 'distance' | null;
    delivery_fee_per_km?: number | string | null;
  } | null;
}

export interface MercadoPagoIntegrationStatus {
  provider: 'mercado_pago';
  isEnabled: boolean;
  isConfigured: boolean;
  hasWebhookSecret: boolean;
  accessTokenMasked: string | null;
  publicKeyMasked: string | null;
  webhookUrl: string;
  updatedAt: string | null;
}

export interface MercadoPagoValidationResult {
  valid: boolean;
  accountEmail: string | null;
  accountName: string | null;
  userId: string | null;
  publicKeyLooksValid: boolean;
}

type DashboardOrderRow = {
  id: string;
  total_amount: number | string | null;
  status: string | null;
  payment_status?: string | null;
  created_at: string;
  order_items?: Array<{ quantity?: number | string | null }> | null;
};

export type SalesPeriod = 'day' | 'month' | 'year';

export type SalesMetrics = {
  revenue: number;
  ordersCount: number;
  itemsSold: number;
  ticketAverage: number;
};

export type DashboardMetrics = {
  timezone: string;
  validStatuses: string[];
  paidPendingPaymentStatuses: string[];
  periods: Record<SalesPeriod, SalesMetrics>;
};

const OPERATIONAL_TIMEZONE = 'America/Sao_Paulo';
const OPERATIONAL_OFFSET = '-03:00';
const NON_REVENUE_ORDER_STATUSES = ['cancelled'];
const VALID_REVENUE_PAYMENT_STATUSES = ['paid', 'approved', 'authorized', 'succeeded'];
const WEB_APP_URL = (process.env.EXPO_PUBLIC_WEB_APP_URL || 'https://restaurante-mamitaria-app.vercel.app').replace(/\/+$/, '');

function getZonedDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: OPERATIONAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const read = (type: 'year' | 'month' | 'day') => parts.find((part) => part.type === type)?.value ?? '00';

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
  };
}

function getPeriodBoundaries(date = new Date()) {
  const { year, month, day } = getZonedDateParts(date);

  return {
    dayStart: `${year}-${month}-${day}T00:00:00${OPERATIONAL_OFFSET}`,
    monthStart: `${year}-${month}-01T00:00:00${OPERATIONAL_OFFSET}`,
    yearStart: `${year}-01-01T00:00:00${OPERATIONAL_OFFSET}`,
  };
}

function emptySalesMetrics(): SalesMetrics {
  return {
    revenue: 0,
    ordersCount: 0,
    itemsSold: 0,
    ticketAverage: 0,
  };
}

function isRevenueEligibleOrder(order: DashboardOrderRow) {
  const normalizedStatus = (order.status ?? '').toLowerCase();
  const normalizedPaymentStatus = (order.payment_status ?? '').toLowerCase();

  if (NON_REVENUE_ORDER_STATUSES.includes(normalizedStatus)) {
    return false;
  }

  return VALID_REVENUE_PAYMENT_STATUSES.includes(normalizedPaymentStatus);
}

function calculateSalesMetrics(orders: DashboardOrderRow[]): SalesMetrics {
  const revenue = orders.reduce((acc, order) => acc + Number(order.total_amount || 0), 0);
  const itemsSold = orders.reduce(
    (acc, order) =>
      acc +
      (order.order_items ?? []).reduce(
        (itemsAcc, item) => itemsAcc + Number(item.quantity || 0),
        0,
      ),
    0,
  );
  const ordersCount = orders.length;

  return {
    revenue,
    ordersCount,
    itemsSold,
    ticketAverage: ordersCount > 0 ? revenue / ordersCount : 0,
  };
}

async function adminApiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (sessionError || !accessToken) {
    throw new Error('Sua sessão expirou. Faça login novamente para continuar.');
  }

  const response = await fetch(`${WEB_APP_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers || {}),
    },
  });

  const bodyText = await response.text();
  const parsedBody = bodyText ? JSON.parse(bodyText) : null;

  if (!response.ok) {
    throw new Error(parsedBody?.error?.message || parsedBody?.message || 'Não foi possível concluir a operação.');
  }

  return parsedBody as T;
}

export const api = {
  orders: {
    list: (restaurantId: string) =>
      supabase.from('orders').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false }),
    updateStatus: (orderId: string, status: string) =>
      supabase.from('orders').update({ status }).eq('id', orderId),
    details: (orderId: string) =>
      supabase.from('orders').select('*, order_items(*, products(*))').eq('id', orderId).maybeSingle(),
  },
  products: {
    list: async (restaurantId: string) => {
      const response = await supabase
        .from('products')
        .select('id, restaurant_id, category_id, name, description, price, promo_price, image_url, is_available, created_at, category:categories(name, is_active)')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      const { data, error } = response as {
        data: AdminProductRow[] | null;
        error: unknown;
      };

      return {
        data: (data ?? []).map((product) => ({
          ...product,
          category: normalizeProductCategory(product),
        })),
        error: error as ApiErrorLike | null,
      };
    },
    upsert: (product: Partial<AdminProduct>) =>
      supabase
        .from('products')
        .upsert(product)
        .select('id, restaurant_id, category_id, name, description, price, promo_price, image_url, is_available, created_at')
        .single(),
    archive: (id: string, restaurantId: string) =>
      supabase
        .from('products')
        .update({ is_available: false })
        .eq('id', id)
        .eq('restaurant_id', restaurantId),
  },
  categories: {
    list: (restaurantId: string) =>
      supabase
        .from('categories')
        .select('id, restaurant_id, name, position, is_active, created_at')
        .eq('restaurant_id', restaurantId)
        .order('position', { ascending: true }),
    validateOwnership: (restaurantId: string, categoryId: string) =>
      supabase
        .from('categories')
        .select('id, restaurant_id, is_active')
        .eq('id', categoryId)
        .eq('restaurant_id', restaurantId)
        .maybeSingle(),
    upsert: (category: Partial<AdminCategory>) => supabase.from('categories').upsert(category),
    delete: (id: string) => supabase.from('categories').delete().eq('id', id),
  },
  addons: {
    list: (restaurantId: string) =>
      supabase
        .from('addons')
        .select('id, restaurant_id, name, price, is_available, created_at')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false }),
    upsert: (addon: Partial<AdminAddon>) => supabase.from('addons').upsert(addon),
    delete: (id: string) => supabase.from('addons').delete().eq('id', id),
  },
  productAddons: {
    list: async (productId: string) => {
      const response = await supabase
        .from('product_addons')
        .select('product_id, addon_id')
        .eq('product_id', productId);

      const { data, error } = response as {
        data: Array<{ product_id: string; addon_id: string }> | null;
        error: unknown;
      };

      return {
        data: (data ?? []).map((item) => item.addon_id),
        error: error as ApiErrorLike | null,
      };
    },
    replace: async (productId: string, addonIds: string[]) => {
      const deleteResponse = await supabase.from('product_addons').delete().eq('product_id', productId);
      const deleteError = (deleteResponse as { error: unknown }).error as ApiErrorLike | null;

      if (deleteError) {
        return {
          data: null,
          error: deleteError,
        };
      }

      if (addonIds.length === 0) {
        return {
          data: [],
          error: null,
        };
      }

      const insertResponse = await supabase
        .from('product_addons')
        .insert(addonIds.map((addonId) => ({ product_id: productId, addon_id: addonId })));

      return {
        data: addonIds,
        error: (insertResponse as { error: unknown }).error as ApiErrorLike | null,
      };
    },
  },
  productOptions: {
    list: async (productId: string) => {
      const { data: groupsData, error: groupsError } = await supabase
        .from('product_options')
        .select('id, product_id, name, min_select, max_select, position')
        .eq('product_id', productId)
        .order('position', { ascending: true });

      if (groupsError) {
        return {
          data: null,
          error: groupsError as ApiErrorLike,
        };
      }

      const groups = (groupsData ?? []) as Array<Omit<AdminProductOptionGroup, 'items'>>;
      const groupIds = groups.map((group) => group.id).filter((groupId): groupId is string => Boolean(groupId));

      let itemsByGroupId = new Map<string, AdminProductOptionItem[]>();

      if (groupIds.length > 0) {
        const { data: itemsData, error: itemsError } = await supabase
          .from('product_option_items')
          .select('id, option_id, name, price_adjustment, is_available, position')
          .in('option_id', groupIds)
          .order('position', { ascending: true });

        if (itemsError) {
          return {
            data: null,
            error: itemsError as ApiErrorLike,
          };
        }

        itemsByGroupId = ((itemsData ?? []) as AdminProductOptionItem[]).reduce((map, item) => {
          const currentItems = map.get(item.option_id ?? '') ?? [];
          currentItems.push(item);
          map.set(item.option_id ?? '', currentItems);
          return map;
        }, new Map<string, AdminProductOptionItem[]>());
      }

      return {
        data: groups.map((group) => ({
          ...group,
          items: itemsByGroupId.get(group.id ?? '') ?? [],
        })),
        error: null,
      };
    },
    replace: async (productId: string, groups: AdminProductOptionGroup[]) => {
      const existingGroupsResponse = await supabase
        .from('product_options')
        .select('id')
        .eq('product_id', productId);

      const existingGroupsError = (existingGroupsResponse as { error: unknown }).error as ApiErrorLike | null;

      if (existingGroupsError) {
        return {
          data: null,
          error: existingGroupsError,
        };
      }

      const existingGroupIds = (((existingGroupsResponse as { data?: Array<{ id: string }> | null }).data) ?? []).map((group) => group.id);

      if (existingGroupIds.length > 0) {
        const deleteItemsResponse = await supabase.from('product_option_items').delete().in('option_id', existingGroupIds);
        const deleteItemsError = (deleteItemsResponse as { error: unknown }).error as ApiErrorLike | null;

        if (deleteItemsError) {
          return {
            data: null,
            error: deleteItemsError,
          };
        }
      }

      const deleteGroupsResponse = await supabase.from('product_options').delete().eq('product_id', productId);
      const deleteGroupsError = (deleteGroupsResponse as { error: unknown }).error as ApiErrorLike | null;

      if (deleteGroupsError) {
        return {
          data: null,
          error: deleteGroupsError,
        };
      }

      if (groups.length === 0) {
        return {
          data: [],
          error: null,
        };
      }

      const { data: insertedGroups, error: insertGroupsError } = await supabase
        .from('product_options')
        .insert(
          groups.map((group, index) => ({
            product_id: productId,
            name: group.name,
            min_select: 1,
            max_select: 1,
            position: index,
          })),
        )
        .select('id, product_id, name, min_select, max_select, position');

      if (insertGroupsError) {
        return {
          data: null,
          error: insertGroupsError as ApiErrorLike,
        };
      }

      const normalizedGroups = (insertedGroups ?? []) as Array<Omit<AdminProductOptionGroup, 'items'>>;
      const itemRows = normalizedGroups.flatMap((group, groupIndex) =>
        (groups[groupIndex]?.items ?? []).map((item, itemIndex) => ({
          option_id: group.id,
          name: item.name,
          price_adjustment: item.price_adjustment,
          is_available: item.is_available ?? true,
          position: itemIndex,
        })),
      );

      if (itemRows.length > 0) {
        const insertItemsResponse = await supabase.from('product_option_items').insert(itemRows);
        const insertItemsError = (insertItemsResponse as { error: unknown }).error as ApiErrorLike | null;

        if (insertItemsError) {
          return {
            data: null,
            error: insertItemsError,
          };
        }
      }

      return api.productOptions.list(productId);
    },
  },
  coupons: {
    list: (restaurantId: string) =>
      supabase.from('coupons').select('*').eq('restaurant_id', restaurantId),
    upsert: (coupon: any) => supabase.from('coupons').upsert(coupon),
    delete: (id: string) => supabase.from('coupons').delete().eq('id', id),
  },
  customers: {
    list: (restaurantId: string) =>
      supabase.from('profiles').select('*, orders(total_amount)').eq('restaurant_id', restaurantId).eq('role', 'customer'),
  },
  restaurants: {
    get: (id: string) => supabase.from('restaurants').select('*').eq('id', id).maybeSingle(),
    update: (id: string, payload: Partial<AdminRestaurant>) => supabase.from('restaurants').update(payload).eq('id', id),
  },
  paymentIntegrations: {
    mercadoPagoStatus: () =>
      adminApiRequest<MercadoPagoIntegrationStatus>('/api/admin/mercado-pago', {
        method: 'GET',
      }),
    saveMercadoPago: (payload: {
      accessToken: string;
      publicKey: string;
      webhookSecret?: string | null;
      isEnabled: boolean;
    }) =>
      adminApiRequest<MercadoPagoIntegrationStatus>('/api/admin/mercado-pago', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    toggleMercadoPago: (isEnabled: boolean) =>
      adminApiRequest<MercadoPagoIntegrationStatus>('/api/admin/mercado-pago', {
        method: 'PUT',
        body: JSON.stringify({ isEnabled }),
      }),
    validateMercadoPago: (payload: { accessToken: string; publicKey?: string | null }) =>
      adminApiRequest<MercadoPagoValidationResult>('/api/admin/mercado-pago/validate', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },
  stats: {
    dashboardMetrics: async (restaurantId: string): Promise<DashboardMetrics> => {
      const { dayStart, monthStart, yearStart } = getPeriodBoundaries();

      const { data, error } = await supabase
        .from('orders')
        .select('id, total_amount, status, payment_status, created_at, order_items(quantity)')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', yearStart)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const orders = ((data ?? []) as DashboardOrderRow[]).filter(isRevenueEligibleOrder);
      const dayOrders = orders.filter((order) => order.created_at >= dayStart);
      const monthOrders = orders.filter((order) => order.created_at >= monthStart);

      return {
        timezone: OPERATIONAL_TIMEZONE,
        validStatuses: [],
        paidPendingPaymentStatuses: VALID_REVENUE_PAYMENT_STATUSES,
        periods: {
          day: calculateSalesMetrics(dayOrders),
          month: calculateSalesMetrics(monthOrders),
          year: calculateSalesMetrics(orders),
        },
      };
    },
  },
};

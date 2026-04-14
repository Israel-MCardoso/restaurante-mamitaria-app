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
    upsert: (product: Partial<AdminProduct>) => supabase.from('products').upsert(product),
    delete: (id: string) => supabase.from('products').delete().eq('id', id),
  },
  categories: {
    list: (restaurantId: string) =>
      supabase
        .from('categories')
        .select('id, restaurant_id, name, position, is_active, created_at')
        .eq('restaurant_id', restaurantId)
        .order('position', { ascending: true }),
    upsert: (category: Partial<AdminCategory>) => supabase.from('categories').upsert(category),
    delete: (id: string) => supabase.from('categories').delete().eq('id', id),
  },
  addons: {
    list: (restaurantId: string) =>
      supabase.from('addons').select('*').eq('restaurant_id', restaurantId),
    upsert: (addon: any) => supabase.from('addons').upsert(addon),
    delete: (id: string) => supabase.from('addons').delete().eq('id', id),
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
  stats: {
    summary: async (restaurantId: string) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount, status, created_at')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', today.toISOString());

      const revenue = orders?.filter(o => o.status !== 'cancelled').reduce((acc, o) => acc + Number(o.total_amount), 0) || 0;
      const count = orders?.length || 0;
      const ticket = count > 0 ? revenue / count : 0;

      return { revenue, count, ticket, orders };
    },
  },
};

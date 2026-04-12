import { supabase } from '../lib/supabase';

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
    list: (restaurantId: string) =>
      supabase.from('products').select('*, categories(name)').eq('restaurant_id', restaurantId).order('name'),
    upsert: (product: any) => supabase.from('products').upsert(product),
    delete: (id: string) => supabase.from('products').delete().eq('id', id),
  },
  categories: {
    list: (restaurantId: string) =>
      supabase.from('categories').select('*').eq('restaurant_id', restaurantId).order('position'),
    upsert: (category: any) => supabase.from('categories').upsert(category),
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
    update: (id: string, payload: any) => supabase.from('restaurants').update(payload).eq('id', id),
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
    }
  }
};

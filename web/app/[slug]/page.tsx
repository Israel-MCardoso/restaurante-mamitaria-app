import { getSupabaseClient } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import { StorefrontRestaurantSync } from '@/components/storefront/StorefrontRestaurantSync';

async function getRestaurant(slug: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('restaurants')
    .select('*, categories(*, products(*))')
    .eq('slug', slug)
    .single();

  if (error || !data) return null;
  return data;
}

export default async function RestaurantPage({ params }: { params: { slug: string } }) {
  const restaurant = await getRestaurant(params.slug);

  if (!restaurant) {
    notFound();
  }

  const visibleCategories = (restaurant.categories || [])
    .filter((category: any) => category.is_active !== false)
    .map((category: any) => ({
      ...category,
      products: (category.products || []).filter((product: any) => product.is_available !== false),
    }))
    .filter((category: any) => category.products.length > 0);

  return (
    <main className="min-h-screen bg-gray-50">
      <StorefrontRestaurantSync
        restaurant={{
          id: restaurant.id,
          slug: restaurant.slug,
          name: restaurant.name,
        }}
      />

      {/* Banner */}
      <div className="h-48 bg-gray-300 relative">
        {restaurant.banner_url && (
          <img src={restaurant.banner_url} alt={restaurant.name} className="w-full h-full object-cover" />
        )}
      </div>

      <div className="max-w-4xl mx-auto p-4 -mt-12 relative">
        <div className="bg-white rounded-lg shadow-lg p-6 flex items-end gap-4">
          <div className="w-24 h-24 bg-white rounded-lg shadow border overflow-hidden">
            {restaurant.logo_url && <img src={restaurant.logo_url} alt={restaurant.name} />}
          </div>
          <div className="pb-2">
            <h1 className="text-2xl font-bold">{restaurant.name}</h1>
            <p className="text-gray-500 text-sm">Aberto hoje: 11:00 - 22:00</p>
          </div>
        </div>

        {/* Categories & Products */}
        <div className="mt-8 space-y-8">
          {visibleCategories.map((category: any) => (
            <section key={category.id}>
              <h2 className="text-xl font-semibold mb-4">{category.name}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {category.products?.map((product: any) => (
                  <div key={product.id} className="bg-white p-4 rounded-lg shadow-sm border flex justify-between gap-4 hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex-1">
                      <h3 className="font-medium">{product.name}</h3>
                      <p className="text-gray-500 text-sm line-clamp-2">{product.description}</p>
                      <p className="text-green-600 font-bold mt-2">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.promo_price ?? product.price)}
                      </p>
                    </div>
                    {product.image_url && (
                      <img src={product.image_url} alt={product.name} className="w-24 h-24 rounded-lg object-cover" />
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

import { notFound } from 'next/navigation';
import { StorefrontRestaurantSync } from '@/components/storefront/StorefrontRestaurantSync';
import { getSupabaseClient } from '@/lib/supabase';

type RestaurantRecord = {
  id: string;
  slug: string;
  name: string;
  banner_url?: string | null;
  logo_url?: string | null;
};

type CategoryRecord = {
  id: string;
  restaurant_id: string;
  name: string;
  is_active?: boolean | null;
};

type ProductRecord = {
  id: string;
  category_id: string;
  name: string;
  description?: string | null;
  price: number;
  promo_price?: number | null;
  image_url?: string | null;
  is_available?: boolean | null;
};

type StorefrontCategory = CategoryRecord & {
  products: ProductRecord[];
};

async function getRestaurant(slug: string) {
  const supabase = getSupabaseClient();

  const restaurantResponse = await supabase
    .from('restaurants')
    .select('id, slug, name, banner_url, logo_url')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  const { data: restaurantData, error: restaurantError } = restaurantResponse as {
    data: RestaurantRecord | null;
    error: unknown;
  };

  if (restaurantError || !restaurantData) {
    return null;
  }

  const categoriesResponse = await supabase
    .from('categories')
    .select('id, restaurant_id, name, is_active')
    .eq('restaurant_id', restaurantData.id)
    .order('position', { ascending: true });

  const { data: categoriesData, error: categoriesError } = categoriesResponse as {
    data: CategoryRecord[] | null;
    error: unknown;
  };

  if (categoriesError) {
    return null;
  }

  const activeCategories = (categoriesData ?? []).filter((category) => category.is_active !== false);
  const categoryIds = activeCategories.map((category) => category.id);

  let productsByCategoryId = new Map<string, ProductRecord[]>();

  if (categoryIds.length > 0) {
    const productsResponse = await supabase
      .from('products')
      .select('id, category_id, name, description, price, promo_price, image_url, is_available')
      .in('category_id', categoryIds);

    const { data: productsData, error: productsError } = productsResponse as {
      data: ProductRecord[] | null;
      error: unknown;
    };

    if (productsError) {
      return null;
    }

    productsByCategoryId = (productsData ?? [])
      .filter((product) => product.is_available !== false)
      .reduce((map, product) => {
        const categoryProducts = map.get(product.category_id) ?? [];
        categoryProducts.push(product);
        map.set(product.category_id, categoryProducts);
        return map;
      }, new Map<string, ProductRecord[]>());
  }

  const categories = activeCategories
    .map<StorefrontCategory>((category) => ({
      ...category,
      products: productsByCategoryId.get(category.id) ?? [],
    }))
    .filter((category) => category.products.length > 0);

  return {
    ...restaurantData,
    categories,
  };
}

export default async function RestaurantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await getRestaurant(slug);

  if (!restaurant) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <StorefrontRestaurantSync
        restaurant={{
          id: restaurant.id,
          slug: restaurant.slug,
          name: restaurant.name,
        }}
      />

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

        <div className="mt-8 space-y-8">
          {restaurant.categories.map((category) => (
            <section key={category.id}>
              <h2 className="text-xl font-semibold mb-4">{category.name}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {category.products.map((product) => (
                  <div
                    key={product.id}
                    className="bg-white p-4 rounded-lg shadow-sm border flex justify-between gap-4 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium">{product.name}</h3>
                      <p className="text-gray-500 text-sm line-clamp-2">{product.description}</p>
                      <p className="text-green-600 font-bold mt-2">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          product.promo_price ?? product.price,
                        )}
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

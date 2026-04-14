import { notFound } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';
import { StorefrontExperience } from '@/components/storefront/StorefrontExperience';
import { SiteFooter, StorefrontHeader } from '@/components/site/SiteChrome';

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
    <>
      <StorefrontHeader storefrontHref={`/${restaurant.slug}`} />
      <StorefrontExperience restaurant={restaurant} categories={restaurant.categories} />
      <SiteFooter />
    </>
  );
}

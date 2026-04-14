import { getSupabaseClient } from '@/lib/supabase';
import { MarketingHomePage } from '@/components/site/MarketingHomePage';
import { MarketingHeader, SiteFooter } from '@/components/site/SiteChrome';

export const dynamic = 'force-dynamic';

type LandingRestaurant = {
  id: string;
  slug: string;
  name: string;
};

type LandingCategory = {
  id: string;
  name: string;
  position?: number | null;
  is_active?: boolean | null;
};

type LandingProduct = {
  id: string;
  category_id: string;
  name: string;
  description?: string | null;
  price: number;
  promo_price?: number | null;
  image_url?: string | null;
  is_available?: boolean | null;
};

async function getLandingData() {
  const supabase = getSupabaseClient();

  const restaurantResponse = await supabase
    .from('restaurants')
    .select('id, slug, name')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: restaurantData, error: restaurantError } = restaurantResponse as {
    data: LandingRestaurant | null;
    error: unknown;
  };

  if (restaurantError || !restaurantData?.slug) {
    return {
      storefrontHref: null,
      restaurantName: null,
      previewItems: [],
    };
  }

  const categoriesResponse = await supabase
    .from('categories')
    .select('id, name, position, is_active')
    .eq('restaurant_id', restaurantData.id)
    .order('position', { ascending: true });

  const { data: categoriesData, error: categoriesError } = categoriesResponse as {
    data: LandingCategory[] | null;
    error: unknown;
  };

  if (categoriesError) {
    return {
      storefrontHref: `/${restaurantData.slug}`,
      restaurantName: restaurantData.name,
      previewItems: [],
    };
  }

  const activeCategories = (categoriesData ?? []).filter((category) => category.is_active !== false);
  const categoryMap = new Map(activeCategories.map((category) => [category.id, category.name]));
  const categoryIds = activeCategories.map((category) => category.id);

  if (categoryIds.length === 0) {
    return {
      storefrontHref: `/${restaurantData.slug}`,
      restaurantName: restaurantData.name,
      previewItems: [],
    };
  }

  const productsResponse = await supabase
    .from('products')
    .select('id, category_id, name, description, price, promo_price, image_url, is_available')
    .in('category_id', categoryIds)
    .order('created_at', { ascending: false });

  const { data: productsData, error: productsError } = productsResponse as {
    data: LandingProduct[] | null;
    error: unknown;
  };

  const previewItems = productsError
    ? []
    : (productsData ?? [])
        .filter((product) => product.is_available !== false)
        .slice(0, 3)
        .map((product) => ({
          id: product.id,
          name: product.name,
          description: product.description ?? '',
          imageUrl: product.image_url ?? null,
          price: Number(product.promo_price ?? product.price),
          categoryName: categoryMap.get(product.category_id) ?? null,
        }));

  return {
    storefrontHref: `/${restaurantData.slug}`,
    restaurantName: restaurantData.name,
    previewItems,
  };
}

export default async function HomePage() {
  const landingData = await getLandingData();

  return (
    <>
      <MarketingHeader storefrontHref={landingData.storefrontHref ?? '/checkout'} />
      <MarketingHomePage
        storefrontHref={landingData.storefrontHref}
        restaurantName={landingData.restaurantName}
        previewItems={landingData.previewItems}
      />
      <SiteFooter />
    </>
  );
}

import { notFound } from 'next/navigation';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
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
  addons?: AddonRecord[];
};

type AddonRecord = {
  id: string;
  name: string;
  price: number;
  is_available?: boolean | null;
};

type StorefrontCategory = CategoryRecord & {
  products: ProductRecord[];
};

function logStorefrontReadError(scope: string, error: unknown) {
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[storefront:${scope}]`, error);
  }
}

async function getRestaurant(slug: string) {
  const supabase = getSupabaseAdminClient();

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
    logStorefrontReadError('restaurant', restaurantError);
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

  const activeCategories = categoriesError
    ? []
    : (categoriesData ?? []).filter((category) => category.is_active !== false);

  if (categoriesError) {
    logStorefrontReadError('categories', categoriesError);
  }

  const categoryIds = activeCategories.map((category) => category.id);

  let productsByCategoryId = new Map<string, ProductRecord[]>();

  if (categoryIds.length > 0) {
    const productsResponse = await supabase
      .from('products')
      .select('id, category_id, name, description, price, promo_price, image_url, is_available')
      .eq('restaurant_id', restaurantData.id)
      .in('category_id', categoryIds);

    const { data: productsData, error: productsError } = productsResponse as {
      data: ProductRecord[] | null;
      error: unknown;
    };

    if (productsError) {
      logStorefrontReadError('products', productsError);
    } else {
      const availableProducts = (productsData ?? []).filter((product) => product.is_available !== false);
      const productIds = availableProducts.map((product) => product.id);
      const addonsByProductId = new Map<string, AddonRecord[]>();

      if (productIds.length > 0) {
        const productAddonsResponse = await supabase
          .from('product_addons')
          .select('product_id, addon_id')
          .in('product_id', productIds);

        const { data: productAddonsData, error: productAddonsError } = productAddonsResponse as {
          data: Array<{ product_id: string; addon_id: string }> | null;
          error: unknown;
        };

        if (productAddonsError) {
          logStorefrontReadError('product_addons', productAddonsError);
        } else {
          const addonIds = Array.from(new Set((productAddonsData ?? []).map((relation) => relation.addon_id)));
          const relationMap = (productAddonsData ?? []).reduce((map, relation) => {
            const productAddonIds = map.get(relation.product_id) ?? [];
            productAddonIds.push(relation.addon_id);
            map.set(relation.product_id, productAddonIds);
            return map;
          }, new Map<string, string[]>());

          if (addonIds.length > 0) {
            const addonsResponse = await supabase
              .from('addons')
              .select('id, name, price, is_available')
              .eq('restaurant_id', restaurantData.id)
              .in('id', addonIds);

            const { data: addonsData, error: addonsError } = addonsResponse as {
              data: AddonRecord[] | null;
              error: unknown;
            };

            if (addonsError) {
              logStorefrontReadError('addons', addonsError);
            } else {
              const availableAddonsMap = new Map(
                (addonsData ?? [])
                  .filter((addon) => addon.is_available !== false)
                  .map((addon) => [addon.id, addon] as const),
              );

              for (const [productId, linkedAddonIds] of relationMap.entries()) {
                const productAddons = linkedAddonIds
                  .map((addonId) => availableAddonsMap.get(addonId))
                  .filter((addon): addon is AddonRecord => Boolean(addon));

                addonsByProductId.set(productId, productAddons);
              }
            }
          }
        }
      }

      productsByCategoryId = availableProducts.reduce((map, product) => {
        const categoryProducts = map.get(product.category_id) ?? [];
        categoryProducts.push({
          ...product,
          addons: addonsByProductId.get(product.id) ?? [],
        });
        map.set(product.category_id, categoryProducts);
        return map;
      }, new Map<string, ProductRecord[]>());
    }
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
      <SiteFooter storefrontHref={`/${restaurant.slug}`} />
    </>
  );
}

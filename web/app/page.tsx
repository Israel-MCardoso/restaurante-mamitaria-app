import { getSupabaseClient } from '@/lib/supabase';
import { MarketingHomePage } from '@/components/site/MarketingHomePage';
import { SiteFooter, SiteHeader } from '@/components/site/SiteChrome';

export const dynamic = 'force-dynamic';

async function getDefaultRestaurantSlug() {
  const supabase = getSupabaseClient();
  const response = await supabase
    .from('restaurants')
    .select('slug')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  const { data, error } = response as {
    data: { slug?: string | null } | null;
    error: unknown;
  };
  const slug = typeof data?.slug === 'string' ? data.slug : null;

  if (error || !slug) {
    return null;
  }

  return slug;
}

export default async function HomePage() {
  const slug = await getDefaultRestaurantSlug();

  return (
    <>
      <SiteHeader fallbackMenuHref={slug ? `/${slug}` : '/checkout'} />
      <MarketingHomePage storefrontHref={slug ? `/${slug}` : null} />
      <SiteFooter />
    </>
  );
}

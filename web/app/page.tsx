import { redirect } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';

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

  if (slug) {
    redirect(`/${slug}`);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
        <div className="w-full rounded-2xl bg-white p-8 text-center shadow-sm border border-gray-100">
          <h1 className="text-2xl font-bold text-gray-900">Loja indisponivel no momento</h1>
          <p className="mt-3 text-sm text-gray-600">
            Nao foi encontrada nenhuma loja ativa para abrir na pagina inicial.
          </p>
        </div>
      </div>
    </main>
  );
}

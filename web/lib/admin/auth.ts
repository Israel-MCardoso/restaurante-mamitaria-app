import { ApiError } from '@/lib/api/errors';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

export interface AdminRequestContext {
  userId: string;
  email: string | null;
  restaurantId: string;
  role: 'admin' | 'manager';
}

export async function requireAdminRequest(request: Request): Promise<AdminRequestContext> {
  const authorization = request.headers.get('authorization') ?? '';

  if (!authorization.toLowerCase().startsWith('bearer ')) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Sessão inválida. Faça login novamente.');
  }

  const accessToken = authorization.slice(7).trim();

  if (!accessToken) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Sessão inválida. Faça login novamente.');
  }

  const supabase = getSupabaseAdminClient();
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);

  if (authError || !authData.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Sessão inválida. Faça login novamente.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('restaurant_id, role')
    .eq('id', authData.user.id)
    .maybeSingle();

  const adminProfile = profile as { restaurant_id?: string | null; role?: 'admin' | 'manager' | 'staff' | 'customer' | null } | null;

  if (profileError || !adminProfile?.restaurant_id) {
    throw new ApiError(403, 'ADMIN_PROFILE_NOT_FOUND', 'Não encontramos um restaurante vinculado ao seu acesso.');
  }

  if (adminProfile.role !== 'admin' && adminProfile.role !== 'manager') {
    throw new ApiError(403, 'FORBIDDEN', 'Seu usuário não possui permissão para configurar pagamentos.');
  }

  return {
    userId: authData.user.id,
    email: authData.user.email ?? null,
    restaurantId: adminProfile.restaurant_id,
    role: adminProfile.role,
  };
}

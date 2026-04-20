import * as SecureStore from 'expo-secure-store';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

const RESTAURANT_CONTEXT_KEY = 'restaurant-context-v1';
const STORAGE_TIMEOUT_MS = 4000;
const SESSION_TIMEOUT_MS = 8000;
const PROFILE_TIMEOUT_MS = 10000;

type CachedRestaurantContext = {
  userId: string;
  email: string | null;
  restaurantId: string;
  role: string | null;
  updatedAt: string;
};

export type RestaurantResolution = {
  userId: string | null;
  email: string | null;
  profileRestaurantId: string | null;
  metadataRestaurantId: string | null;
  cachedRestaurantId: string | null;
  resolvedRestaurantId: string | null;
  role: string | null;
  error: string | null;
  source: 'profile' | 'metadata' | 'cache' | 'none';
};

type OperationalRole = 'admin' | 'manager';

export type OperationalRestaurantContext = {
  userId: string;
  email: string | null;
  restaurantId: string;
  role: OperationalRole;
  source: 'profile' | 'metadata' | 'cache' | 'none';
};

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${label} demorou mais do que o esperado.`));
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

async function safeDeleteCachedRestaurantContext(reason: string) {
  try {
    await withTimeout(SecureStore.deleteItemAsync(RESTAURANT_CONTEXT_KEY), STORAGE_TIMEOUT_MS, 'A limpeza do contexto salvo');
    console.info('[restaurant-context] cached context cleared', { reason });
  } catch (error: any) {
    console.warn('[restaurant-context] failed to clear cached context', {
      reason,
      message: error?.message ?? 'unknown error',
    });
  }
}

async function readCachedRestaurantContext() {
  try {
    const rawValue = await withTimeout(
      SecureStore.getItemAsync(RESTAURANT_CONTEXT_KEY),
      STORAGE_TIMEOUT_MS,
      'A leitura do contexto salvo',
    );

    if (!rawValue) {
      console.info('[restaurant-context] no cached context found');
      return null;
    }

    try {
      const parsed = JSON.parse(rawValue) as CachedRestaurantContext;

      if (!parsed?.userId || !parsed?.restaurantId) {
        console.warn('[restaurant-context] cached context is incomplete, clearing');
        await safeDeleteCachedRestaurantContext('invalid-shape');
        return null;
      }

      return parsed;
    } catch (error: any) {
      console.warn('[restaurant-context] cached context is corrupted, clearing', {
        message: error?.message ?? 'invalid json',
      });
      await safeDeleteCachedRestaurantContext('corrupted-json');
      return null;
    }
  } catch (error: any) {
    console.warn('[restaurant-context] failed to read cached context', {
      message: error?.message ?? 'unknown error',
    });
    return null;
  }
}

export async function persistRestaurantContext(params: {
  userId: string;
  email?: string | null;
  restaurantId: string;
  role?: string | null;
}) {
  const payload: CachedRestaurantContext = {
    userId: params.userId,
    email: params.email ?? null,
    restaurantId: params.restaurantId,
    role: params.role ?? null,
    updatedAt: new Date().toISOString(),
  };

  await withTimeout(
    SecureStore.setItemAsync(RESTAURANT_CONTEXT_KEY, JSON.stringify(payload)),
    STORAGE_TIMEOUT_MS,
    'A persistencia do contexto salvo',
  );
  return payload;
}

export async function clearRestaurantContext() {
  await withTimeout(
    SecureStore.deleteItemAsync(RESTAURANT_CONTEXT_KEY),
    STORAGE_TIMEOUT_MS,
    'A limpeza do contexto salvo',
  );
}

function getMetadataRestaurantId(user: User | null) {
  if (!user) {
    return null;
  }

  return user.user_metadata?.restaurant_id || user.app_metadata?.restaurant_id || null;
}

function buildResolution(params: Partial<RestaurantResolution>): RestaurantResolution {
  return {
    userId: params.userId ?? null,
    email: params.email ?? null,
    profileRestaurantId: params.profileRestaurantId ?? null,
    metadataRestaurantId: params.metadataRestaurantId ?? null,
    cachedRestaurantId: params.cachedRestaurantId ?? null,
    resolvedRestaurantId: params.resolvedRestaurantId ?? null,
    role: params.role ?? null,
    error: params.error ?? null,
    source: params.source ?? 'none',
  };
}

export async function resolveRestaurantContext(activeSession?: Session | null): Promise<RestaurantResolution> {
  console.info('[restaurant-context] starting restaurant resolution', {
    hasActiveSessionOverride: !!activeSession?.user,
  });

  const cached = await readCachedRestaurantContext();
  let session = activeSession ? { data: { session: activeSession } } : null;

  if (!session) {
    try {
      session = await withTimeout(supabase.auth.getSession(), SESSION_TIMEOUT_MS, 'A leitura da sessao autenticada');
    } catch (error: any) {
      console.error('[restaurant-context] failed to load auth session', {
        message: error?.message ?? 'unknown error',
      });

      return buildResolution({
        cachedRestaurantId: cached?.restaurantId ?? null,
        error: error?.message || 'Nao foi possivel carregar a sessao autenticada.',
        source: cached?.restaurantId ? 'cache' : 'none',
      });
    }
  }

  const user = session.data.session?.user ?? null;

  if (!user) {
    await safeDeleteCachedRestaurantContext('no-authenticated-user');
    console.warn('[restaurant-context] no authenticated user while resolving restaurant context');

    return buildResolution({
      cachedRestaurantId: cached?.restaurantId ?? null,
      error: 'Usuario nao autenticado.',
      source: 'none',
    });
  }

  const metadataRestaurantId = getMetadataRestaurantId(user);
  const cachedRestaurantId = cached?.userId === user.id ? cached.restaurantId : null;
  const cachedRole = cached?.userId === user.id ? cached.role : null;

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('profiles')
        .select('restaurant_id, role')
        .eq('id', user.id)
        .maybeSingle(),
      PROFILE_TIMEOUT_MS,
      'A leitura do perfil operacional',
    );

    if (error) {
      throw error;
    }

    const profileRestaurantId = data?.restaurant_id ?? null;
    const role = data?.role ?? cachedRole ?? null;
    const resolvedRestaurantId = profileRestaurantId || metadataRestaurantId || cachedRestaurantId;
    const source: RestaurantResolution['source'] = profileRestaurantId
      ? 'profile'
      : metadataRestaurantId
        ? 'metadata'
        : cachedRestaurantId
          ? 'cache'
          : 'none';

    if (!resolvedRestaurantId) {
      await safeDeleteCachedRestaurantContext('missing-restaurant-id');
      console.warn('[restaurant-context] restaurant resolution failed: no restaurant_id found', {
        userId: user.id,
        metadataRestaurantId,
        cachedRestaurantId,
      });

      return buildResolution({
        userId: user.id,
        email: user.email ?? null,
        profileRestaurantId,
        metadataRestaurantId,
        cachedRestaurantId,
        role,
        error: 'Seu usuario nao esta vinculado a nenhum restaurante.',
        source,
      });
    }

    try {
      await persistRestaurantContext({
        userId: user.id,
        email: user.email ?? null,
        restaurantId: resolvedRestaurantId,
        role,
      });
    } catch (persistError: any) {
      console.warn('[restaurant-context] failed to persist resolved restaurant context', {
        userId: user.id,
        restaurantId: resolvedRestaurantId,
        message: persistError?.message ?? 'unknown error',
      });
    }

    console.info('[restaurant-context] resolved restaurant context', {
      userId: user.id,
      restaurantId: resolvedRestaurantId,
      role,
      source,
    });

    return buildResolution({
      userId: user.id,
      email: user.email ?? null,
      profileRestaurantId,
      metadataRestaurantId,
      cachedRestaurantId,
      resolvedRestaurantId,
      role,
      source,
    });
  } catch (err: any) {
    if (cachedRestaurantId) {
      console.warn('[restaurant-context] profile lookup failed, using cached restaurant context', {
        userId: user.id,
        cachedRestaurantId,
        message: err?.message ?? 'unknown error',
      });
      return buildResolution({
        userId: user.id,
        email: user.email ?? null,
        metadataRestaurantId,
        cachedRestaurantId,
        resolvedRestaurantId: cachedRestaurantId,
        role: cachedRole,
        source: 'cache',
      });
    }

    if (metadataRestaurantId) {
      console.warn('[restaurant-context] profile lookup failed, using metadata restaurant context', {
        userId: user.id,
        metadataRestaurantId,
        message: err?.message ?? 'unknown error',
      });
      return buildResolution({
        userId: user.id,
        email: user.email ?? null,
        metadataRestaurantId,
        resolvedRestaurantId: metadataRestaurantId,
        role: cachedRole,
        source: 'metadata',
      });
    }

    console.error('[restaurant-context] failed to resolve restaurant context', {
      userId: user.id,
      metadataRestaurantId,
      message: err?.message ?? 'unknown error',
    });

    return buildResolution({
      userId: user.id,
      email: user.email ?? null,
      metadataRestaurantId,
      cachedRestaurantId,
      role: cachedRole,
      error: err?.message || 'Nao foi possivel identificar o restaurante do usuario.',
      source: 'none',
    });
  }
}

export async function ensureOperationalRestaurantContext(activeSession?: Session | null): Promise<OperationalRestaurantContext> {
  const resolution = await resolveRestaurantContext(activeSession);

  if (!resolution.userId) {
    throw new Error('Sessao nao encontrada. Faca login novamente para continuar.');
  }

  if (!resolution.role) {
    throw new Error('Perfil nao encontrado. Nao foi possivel validar o acesso operacional.');
  }

  if (resolution.role !== 'admin' && resolution.role !== 'manager') {
    throw new Error('Voce nao tem permissao para realizar esta operacao.');
  }

  if (!resolution.resolvedRestaurantId) {
    throw new Error(resolution.error || 'Restaurante nao encontrado para esta conta.');
  }

  return {
    userId: resolution.userId,
    email: resolution.email,
    restaurantId: resolution.resolvedRestaurantId,
    role: resolution.role,
    source: resolution.source,
  };
}

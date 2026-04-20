import { useEffect, useState } from 'react';
import { resolveRestaurantContext } from '../services/restaurantContext';

interface RestaurantDebug {
  userId: string | null;
  email: string | null;
  profileRestaurantId: string | null;
  metadataRestaurantId: string | null;
  cachedRestaurantId: string | null;
  resolvedRestaurantId: string | null;
  source: 'profile' | 'metadata' | 'cache' | 'none';
}

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

export function useRestaurant() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<RestaurantDebug>({
    userId: null,
    email: null,
    profileRestaurantId: null,
    metadataRestaurantId: null,
    cachedRestaurantId: null,
    resolvedRestaurantId: null,
    source: 'none',
  });

  useEffect(() => {
    let mounted = true;

    async function loadRestaurantContext() {
      console.info('[useRestaurant] starting restaurant bootstrap');

      try {
        const resolution = await withTimeout(
          resolveRestaurantContext(),
          12000,
          'A resolucao do contexto do restaurante',
        );

        if (!mounted) {
          return;
        }

        console.info('[useRestaurant] restaurant bootstrap resolved', {
          userId: resolution.userId,
          resolvedRestaurantId: resolution.resolvedRestaurantId,
          source: resolution.source,
          hasError: !!resolution.error,
        });

        setDebug({
          userId: resolution.userId,
          email: resolution.email,
          profileRestaurantId: resolution.profileRestaurantId,
          metadataRestaurantId: resolution.metadataRestaurantId,
          cachedRestaurantId: resolution.cachedRestaurantId,
          resolvedRestaurantId: resolution.resolvedRestaurantId,
          source: resolution.source,
        });

        if (!resolution.resolvedRestaurantId) {
          setRestaurantId(null);
          setError(resolution.error);
          return;
        }

        setRestaurantId(resolution.resolvedRestaurantId);
        setError(null);
      } catch (err: any) {
        if (!mounted) {
          return;
        }

        console.error('[useRestaurant] restaurant bootstrap failed', {
          message: err?.message ?? 'unknown error',
        });

        setRestaurantId(null);
        setError(err?.message || 'Nao foi possivel identificar o restaurante do usuario.');
      } finally {
        if (mounted) {
          console.info('[useRestaurant] restaurant bootstrap finalized');
          setLoading(false);
        }
      }
    }

    loadRestaurantContext();

    return () => {
      mounted = false;
    };
  }, []);

  return { restaurantId, loading, error, debug };
}

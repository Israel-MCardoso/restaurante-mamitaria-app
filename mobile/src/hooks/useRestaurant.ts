import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface RestaurantDebug {
  userId: string | null;
  email: string | null;
  profileRestaurantId: string | null;
  metadataRestaurantId: string | null;
  resolvedRestaurantId: string | null;
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
    resolvedRestaurantId: null,
  });

  useEffect(() => {
    async function getRestaurantId() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          setError('Usuario nao autenticado.');
          setDebug({
            userId: null,
            email: null,
            profileRestaurantId: null,
            metadataRestaurantId: null,
            resolvedRestaurantId: null,
          });
          return;
        }

        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('restaurant_id')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        const metadataRestaurantId =
          user.user_metadata?.restaurant_id ||
          user.app_metadata?.restaurant_id ||
          null;

        const profileRestaurantId = data?.restaurant_id || null;
        const resolvedRestaurantId = profileRestaurantId || metadataRestaurantId;

        setDebug({
          userId: user.id,
          email: user.email || null,
          profileRestaurantId,
          metadataRestaurantId,
          resolvedRestaurantId,
        });

        if (!resolvedRestaurantId) {
          setError('Seu usuario nao esta vinculado a nenhum restaurante.');
          return;
        }

        setRestaurantId(resolvedRestaurantId);
        setError(null);
      } catch (err: any) {
        setRestaurantId(null);
        setError(err?.message || 'Nao foi possivel identificar o restaurante do usuario.');
      } finally {
        setLoading(false);
      }
    }

    getRestaurantId();
  }, []);

  return { restaurantId, loading, error, debug };
}

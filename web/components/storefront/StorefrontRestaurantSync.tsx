'use client';

import { useEffect } from 'react';
import { useStorefront, type StorefrontRestaurant } from '@/contexts/StorefrontContext';

export function StorefrontRestaurantSync({ restaurant }: { restaurant: StorefrontRestaurant }) {
  const { setRestaurant } = useStorefront();

  useEffect(() => {
    setRestaurant(restaurant);
  }, [restaurant, setRestaurant]);

  return null;
}

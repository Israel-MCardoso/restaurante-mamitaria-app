'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export interface StorefrontRestaurant {
  id: string;
  slug: string;
  name: string;
}

interface StorefrontContextType {
  restaurant: StorefrontRestaurant | null;
  setRestaurant: (restaurant: StorefrontRestaurant | null) => void;
}

const STOREFRONT_RESTAURANT_STORAGE_KEY = 'restaurante:current-storefront';

const StorefrontContext = createContext<StorefrontContextType | undefined>(undefined);

export function StorefrontProvider({ children }: { children: React.ReactNode }) {
  const [restaurant, setRestaurantState] = useState<StorefrontRestaurant | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const rawValue = window.localStorage.getItem(STOREFRONT_RESTAURANT_STORAGE_KEY);

      if (!rawValue) {
        return;
      }

      setRestaurantState(JSON.parse(rawValue) as StorefrontRestaurant);
    } catch {
      setRestaurantState(null);
    }
  }, []);

  const setRestaurant = (nextRestaurant: StorefrontRestaurant | null) => {
    setRestaurantState(nextRestaurant);

    if (typeof window === 'undefined') {
      return;
    }

    try {
      if (!nextRestaurant) {
        window.localStorage.removeItem(STOREFRONT_RESTAURANT_STORAGE_KEY);
        return;
      }

      window.localStorage.setItem(STOREFRONT_RESTAURANT_STORAGE_KEY, JSON.stringify(nextRestaurant));
    } catch {
      // Ignore storage errors and keep runtime state only.
    }
  };

  return (
    <StorefrontContext.Provider value={{ restaurant, setRestaurant }}>
      {children}
    </StorefrontContext.Provider>
  );
}

export function useStorefront() {
  const context = useContext(StorefrontContext);

  if (!context) {
    throw new Error('useStorefront must be used within a StorefrontProvider');
  }

  return context;
}

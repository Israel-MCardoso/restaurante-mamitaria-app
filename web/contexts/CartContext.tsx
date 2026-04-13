'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  addons?: any[];
  imageUrl?: string | null;
  description?: string | null;
}

interface CartContextType {
  items: CartItem[];
  restaurantId: string | null;
  setRestaurantScope: (restaurantId: string) => void;
  addItem: (item: CartItem) => void;
  updateItemQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}

interface StoredCartState {
  restaurantId: string | null;
  items: CartItem[];
}

const CartContext = createContext<CartContextType | undefined>(undefined);
const CART_STORAGE_KEY = 'restaurante:public-cart';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const rawValue = window.localStorage.getItem(CART_STORAGE_KEY);

      if (!rawValue) {
        return;
      }

      const parsedValue = JSON.parse(rawValue) as Partial<StoredCartState>;
      setItems(Array.isArray(parsedValue.items) ? parsedValue.items : []);
      setRestaurantId(typeof parsedValue.restaurantId === 'string' ? parsedValue.restaurantId : null);
    } catch {
      setItems([]);
      setRestaurantId(null);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const nextValue: StoredCartState = {
        restaurantId,
        items,
      };

      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(nextValue));
    } catch {
      // Ignore storage failures and keep runtime-only state.
    }
  }, [items, restaurantId]);

  const setRestaurantScope = (nextRestaurantId: string) => {
    setRestaurantId((currentRestaurantId) => {
      if (!currentRestaurantId || currentRestaurantId === nextRestaurantId) {
        return nextRestaurantId;
      }

      setItems([]);
      return nextRestaurantId;
    });
  };

  const addItem = (item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((cartItem) => cartItem.id === item.id);

      if (existing) {
        return prev.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + item.quantity }
            : cartItem,
        );
      }

      return [...prev, item];
    });
  };

  const updateItemQuantity = (id: string, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) {
        return prev.filter((item) => item.id !== id);
      }

      return prev.map((item) => (item.id === id ? { ...item, quantity } : item));
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => setItems([]);

  const total = useMemo(() => items.reduce((acc, item) => acc + item.price * item.quantity, 0), [items]);
  const itemCount = useMemo(() => items.reduce((acc, item) => acc + item.quantity, 0), [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        restaurantId,
        setRestaurantScope,
        addItem,
        updateItemQuantity,
        removeItem,
        clearCart,
        total,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }

  return context;
};

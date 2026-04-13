'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, ShoppingBag, Store } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { StorefrontRestaurantSync } from '@/components/storefront/StorefrontRestaurantSync';

interface StorefrontProduct {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  promo_price?: number | null;
  image_url?: string | null;
}

interface StorefrontCategory {
  id: string;
  name: string;
  products: StorefrontProduct[];
}

interface StorefrontExperienceProps {
  restaurant: {
    id: string;
    slug: string;
    name: string;
    banner_url?: string | null;
    logo_url?: string | null;
  };
  categories: StorefrontCategory[];
}

export function StorefrontExperience({ restaurant, categories }: StorefrontExperienceProps) {
  const {
    items,
    restaurantId,
    setRestaurantScope,
    addItem,
    updateItemQuantity,
    total,
    itemCount,
  } = useCart();
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    setRestaurantScope(restaurant.id);
  }, [restaurant.id, setRestaurantScope]);

  const cartItems = useMemo(
    () => items.filter((item) => !restaurantId || restaurantId === restaurant.id),
    [items, restaurant.id, restaurantId],
  );

  const addProductToCart = (product: StorefrontProduct) => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.promo_price ?? product.price,
      quantity: 1,
      addons: [],
      imageUrl: product.image_url,
      description: product.description,
    });
    setIsCartOpen(true);
  };

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <StorefrontRestaurantSync
        restaurant={{
          id: restaurant.id,
          slug: restaurant.slug,
          name: restaurant.name,
        }}
      />

      <section className="relative overflow-hidden bg-stone-950 text-white">
        <div className="absolute inset-0">
          {restaurant.banner_url ? (
            <img src={restaurant.banner_url} alt={restaurant.name} className="h-full w-full object-cover opacity-35" />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.35),_rgba(12,10,9,0.98)_58%)]" />
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/50 to-stone-950" />

        <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-6 pb-12 pt-10 md:px-8 md:pb-16">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm backdrop-blur">
            <Store className="h-4 w-4" />
            Pedido online oficial
          </div>

          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="flex max-w-3xl flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border border-white/15 bg-white/90 shadow-2xl">
                  {restaurant.logo_url ? (
                    <img src={restaurant.logo_url} alt={restaurant.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-orange-600">{restaurant.name.charAt(0)}</span>
                  )}
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.32em] text-orange-300">Storefront</p>
                  <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">{restaurant.name}</h1>
                </div>
              </div>
              <p className="max-w-2xl text-sm leading-7 text-stone-200 md:text-base">
                Escolha seus itens, monte o carrinho e finalize o pedido no checkout real da loja. O backend confirma os
                valores finais antes de criar o pedido.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-orange-500 px-5 py-4 text-sm font-semibold text-stone-950 shadow-lg shadow-orange-950/30 transition hover:bg-orange-400"
            >
              <ShoppingBag className="h-5 w-5" />
              Ver carrinho
              <span className="rounded-full bg-stone-950 px-2 py-1 text-xs font-bold text-white">{itemCount}</span>
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10 md:px-8">
        {categories.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-stone-900">Cardápio em atualização</h2>
            <p className="mt-3 text-sm text-stone-600">
              Esta loja já está publicada, mas ainda não possui categorias com produtos disponíveis para compra.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {categories.map((category) => (
              <section key={category.id} className="space-y-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-600">Categoria</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">{category.name}</h2>
                  </div>
                  <p className="text-sm text-stone-500">{category.products.length} itens</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {category.products.map((product) => {
                    const price = product.promo_price ?? product.price;

                    return (
                      <article
                        key={product.id}
                        className="group overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                      >
                        <div className="flex h-full flex-col gap-5 p-5 md:flex-row">
                          <div className="h-32 w-full overflow-hidden rounded-2xl bg-stone-100 md:h-auto md:w-36 md:flex-none">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,_#fed7aa,_#ffedd5)] text-sm font-semibold text-orange-700">
                                Sem foto
                              </div>
                            )}
                          </div>

                          <div className="flex flex-1 flex-col justify-between gap-4">
                            <div>
                              <div className="flex items-start justify-between gap-4">
                                <h3 className="text-lg font-semibold text-stone-900">{product.name}</h3>
                                <div className="text-right">
                                  {product.promo_price ? (
                                    <p className="text-xs text-stone-400 line-through">{formatMoney(product.price)}</p>
                                  ) : null}
                                  <p className="text-lg font-semibold text-orange-600">{formatMoney(price)}</p>
                                </div>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-stone-600">
                                {product.description?.trim() || 'Produto disponível para pedido online.'}
                              </p>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
                                Pedido online
                              </span>
                              <button
                                type="button"
                                onClick={() => addProductToCart(product)}
                                className="rounded-2xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
                              >
                                Adicionar ao carrinho
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      {itemCount > 0 ? (
        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-6 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 items-center justify-between rounded-3xl bg-stone-950 px-5 py-4 text-white shadow-2xl shadow-stone-950/25"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <div className="text-left">
              <p className="text-sm font-semibold">{itemCount} itens no carrinho</p>
              <p className="text-xs text-stone-300">Toque para revisar e seguir ao checkout</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-stone-300">Subtotal</p>
            <p className="text-lg font-semibold">{formatMoney(total)}</p>
          </div>
        </button>
      ) : null}

      {isCartOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/60 p-4 backdrop-blur-sm md:items-center">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-200 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-600">Carrinho</p>
                <h2 className="mt-1 text-2xl font-semibold text-stone-900">Seu pedido</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="rounded-full border border-stone-200 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                Fechar
              </button>
            </div>

            <div className="max-h-[52vh] space-y-4 overflow-y-auto px-6 py-5">
              {cartItems.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center text-sm text-stone-600">
                  Seu carrinho ainda está vazio.
                </div>
              ) : (
                cartItems.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-4 rounded-3xl border border-stone-200 p-4">
                    <div className="flex gap-4">
                      <div className="h-20 w-20 overflow-hidden rounded-2xl bg-stone-100">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs font-semibold text-stone-500">
                            Item
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-stone-900">{item.name}</h3>
                        <p className="mt-1 text-sm text-stone-500">{item.description || 'Produto pronto para checkout'}</p>
                        <p className="mt-3 text-sm font-semibold text-orange-600">{formatMoney(item.price)}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                      <div className="flex items-center gap-2 rounded-full border border-stone-200 px-2 py-1">
                        <button
                          type="button"
                          onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                          className="rounded-full p-1 text-stone-600 hover:bg-stone-100"
                          aria-label={`Remover uma unidade de ${item.name}`}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="min-w-6 text-center text-sm font-semibold">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                          className="rounded-full p-1 text-stone-600 hover:bg-stone-100"
                          aria-label={`Adicionar uma unidade de ${item.name}`}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-sm font-semibold text-stone-900">{formatMoney(item.price * item.quantity)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-stone-200 bg-stone-50 px-6 py-5">
              <div className="flex items-center justify-between text-sm text-stone-600">
                <span>Subtotal</span>
                <span className="font-semibold text-stone-900">{formatMoney(total)}</span>
              </div>
              <p className="mt-2 text-xs text-stone-500">
                Taxa, desconto e valor final são recalculados pelo backend no checkout.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="rounded-2xl border border-stone-300 px-4 py-3 text-sm font-semibold text-stone-700 hover:bg-white"
                >
                  Continuar comprando
                </button>
                <Link
                  href="/checkout"
                  onClick={() => setIsCartOpen(false)}
                  className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                    cartItems.length === 0
                      ? 'pointer-events-none bg-stone-300 text-stone-500'
                      : 'bg-orange-500 text-stone-950 hover:bg-orange-400'
                  }`}
                >
                  Ir para checkout
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

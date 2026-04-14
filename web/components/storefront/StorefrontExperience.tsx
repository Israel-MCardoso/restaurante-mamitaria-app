'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, MessageCircle, Minus, Plus, ShoppingBag } from 'lucide-react';
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
  const { items, restaurantId, setRestaurantScope, addItem, updateItemQuantity, total, itemCount } = useCart();
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    setRestaurantScope(restaurant.id);
  }, [restaurant.id, setRestaurantScope]);

  const cartItems = useMemo(
    () => items.filter((item) => !restaurantId || restaurantId === restaurant.id),
    [items, restaurant.id, restaurantId],
  );

  const totalProducts = useMemo(
    () => categories.reduce((sum, category) => sum + category.products.length, 0),
    [categories],
  );

  const highlightedCategories = useMemo(
    () => categories.filter((category) => category.products.length > 0).slice(0, 6),
    [categories],
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
    <main className="page-shell pt-10 text-stone-900">
      <StorefrontRestaurantSync
        restaurant={{
          id: restaurant.id,
          slug: restaurant.slug,
          name: restaurant.name,
        }}
      />

      <section className="section-shell pt-6">
        <div className="content-shell">
          <div
            className="overflow-hidden rounded-[2.7rem] border"
            style={{ borderColor: 'rgba(201, 139, 100, 0.16)', boxShadow: '0 28px 80px rgba(77, 46, 35, 0.12)' }}
          >
            <div className="relative min-h-[320px] overflow-hidden">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: restaurant.banner_url
                    ? `url('${restaurant.banner_url}')`
                    : "url('https://images.unsplash.com/photo-1621179816782-1c39a6583fbc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxicmF6aWxpYW4lMjBmZWlqb2FkYSUyMGZvb2R8ZW58MXx8fHwxNzc1NzU3MTcxfDA&ixlib=rb-4.1.0&q=80&w=1600')",
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(115deg, rgba(22, 14, 11, 0.84) 0%, rgba(22, 14, 11, 0.63) 48%, rgba(22, 14, 11, 0.22) 100%)',
                }}
              />
              <div
                className="absolute inset-x-0 bottom-0 h-32"
                style={{ background: 'linear-gradient(180deg, rgba(22,14,11,0) 0%, rgba(22,14,11,0.38) 100%)' }}
              />

              <div className="content-shell relative z-10 flex min-h-[320px] items-end py-10 md:py-12">
                <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.52fr)] lg:items-end">
                  <div className="max-w-4xl text-white">
                    <div
                      className="hero-reveal inline-flex items-center gap-3 rounded-full px-4 py-2"
                      style={{
                        backgroundColor: 'rgba(255, 250, 244, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.16)',
                      }}
                    >
                      <span className="text-[0.72rem] font-semibold uppercase tracking-[0.3em] text-white/88">Loja da casa</span>
                    </div>

                    <div className="hero-reveal hero-reveal-delay mt-6 max-w-4xl">
                      <span className="mb-4 block text-sm font-semibold uppercase tracking-[0.28em] text-white/58">
                        Cardápio online
                      </span>
                      <h1
                        className="max-w-[12ch] text-[clamp(3rem,6vw,5.1rem)] font-semibold leading-[0.94] tracking-[-0.055em]"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {restaurant.name}
                      </h1>
                      <p className="mt-5 max-w-2xl text-[clamp(1rem,1.7vw,1.14rem)] leading-8 text-white/78">
                        Escolha com calma, monte seu pedido e avance para o checkout com a mesma atmosfera acolhedora da marca.
                      </p>
                    </div>
                  </div>

                  <div
                    className="premium-surface hero-reveal rounded-[2rem] p-6 text-left"
                    style={{ backgroundColor: 'rgba(255, 250, 244, 0.78)' }}
                  >
                    <div className="grid gap-5">
                      <div>
                        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--brand)' }}>
                          Compra prática
                        </p>
                        <p className="mt-3 text-sm leading-7" style={{ color: 'var(--ink-muted)' }}>
                          O cardápio foi organizado para facilitar a escolha, destacar os pratos certos e levar você ao checkout sem ruído.
                        </p>
                      </div>

                      <div className="grid gap-3 text-sm" style={{ color: 'var(--ink-muted)' }}>
                        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--line)' }}>
                          <span>Categorias ativas</span>
                          <strong style={{ color: 'var(--ink-strong)' }}>{categories.length}</strong>
                        </div>
                        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--line)' }}>
                          <span>Pratos disponíveis</span>
                          <strong style={{ color: 'var(--ink-strong)' }}>{totalProducts}</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Itens no carrinho</span>
                          <strong style={{ color: 'var(--ink-strong)' }}>{itemCount}</strong>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <button type="button" onClick={() => setIsCartOpen(true)} className="premium-button px-6 py-3 sm:w-auto">
                          Ver carrinho
                          <ShoppingBag className="h-4 w-4" />
                        </button>
                        <a
                          href={`https://wa.me/5515991442274?text=${encodeURIComponent(`Olá! Gostaria de pedir na loja ${restaurant.name}.`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border px-6 py-3 text-center text-sm font-semibold transition hover:bg-white"
                          style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
                        >
                          <span className="inline-flex items-center gap-2">
                            <MessageCircle className="h-4 w-4" />
                            WhatsApp
                          </span>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell section-divider overflow-hidden pt-10" style={{ backgroundColor: 'rgba(255, 255, 255, 0.55)' }}>
        <div
          className="absolute left-1/2 top-30 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl"
          style={{ backgroundColor: 'rgba(200, 135, 63, 0.12)' }}
        />
        <div className="content-shell relative z-10">
          {highlightedCategories.length > 0 ? (
            <div className="mb-10 flex flex-wrap items-center gap-3 border-b pb-8" style={{ borderColor: 'rgba(75, 46, 35, 0.1)' }}>
              <span className="text-xs font-semibold uppercase tracking-[0.26em]" style={{ color: 'rgba(53, 39, 34, 0.58)' }}>
                Navegue por
              </span>
              {highlightedCategories.map((category) => (
                <a
                  key={category.id}
                  href={`#category-${category.id}`}
                  className="rounded-full border px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 hover:bg-white"
                  style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
                >
                  {category.name}
                </a>
              ))}
            </div>
          ) : null}

          {categories.length === 0 ? (
            <div className="soft-card rounded-[2rem] p-8 text-center">
              <h2
                className="text-[2.4rem] leading-none tracking-[-0.05em]"
                style={{ color: 'var(--ink-strong)', fontFamily: 'var(--font-display)' }}
              >
                Cardápio em atualização.
              </h2>
              <p className="mt-4 text-base leading-7" style={{ color: 'var(--ink-muted)' }}>
                Estamos preparando novidades para você. Volte em instantes para conferir os pratos disponíveis.
              </p>
            </div>
          ) : (
            <div className="space-y-14">
              <div
                className="section-intro border-b pb-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,0.7fr)] lg:items-end lg:justify-between"
                style={{ borderColor: 'rgba(75, 46, 35, 0.1)' }}
              >
                <div>
                  <span className="section-kicker">Cardápio em destaque</span>
                  <h2 className="section-title mt-4">Pratos com cara de favoritos instantâneos.</h2>
                </div>
                <p className="section-copy lg:justify-self-end">
                  Explore as categorias, escolha seus pratos preferidos e monte seu pedido com uma navegação mais clara, elegante e objetiva.
                </p>
              </div>

              {categories.map((category) => (
                <section
                  key={category.id}
                  id={`category-${category.id}`}
                  className="scroll-mt-28 border-t pt-8"
                  style={{ borderColor: 'rgba(75, 46, 35, 0.08)' }}
                >
                  <div
                    className="grid gap-6 border-b pb-6 md:grid-cols-[minmax(0,1fr)_auto]"
                    style={{ borderColor: 'rgba(75, 46, 35, 0.08)' }}
                  >
                    <div className="max-w-2xl">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--brand)' }}>
                        Categoria
                      </p>
                      <h2
                        className="mt-3 text-[clamp(2.35rem,4vw,3.2rem)] leading-none tracking-[-0.045em]"
                        style={{ color: 'var(--ink-strong)', fontFamily: 'var(--font-display)' }}
                      >
                        {category.name}
                      </h2>
                      <p className="mt-3 max-w-xl text-sm leading-7" style={{ color: 'var(--ink-muted)' }}>
                        Seleção pensada para manter ritmo, clareza e apetite durante toda a experiência de compra.
                      </p>
                    </div>
                    <div className="self-end">
                      <p className="text-sm font-medium" style={{ color: 'var(--ink-muted)' }}>
                        {category.products.length} {category.products.length === 1 ? 'item disponível' : 'itens disponíveis'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 grid gap-5">
                    {category.products.map((product) => {
                      const price = product.promo_price ?? product.price;
                      const hasPromo = Boolean(product.promo_price);

                      return (
                        <article
                          key={product.id}
                          className="group overflow-hidden rounded-[2rem] border bg-[rgba(255,251,246,0.84)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_48px_rgba(92,66,53,0.1)]"
                          style={{ borderColor: 'rgba(75, 46, 35, 0.1)' }}
                        >
                          <div className="grid h-full gap-5 p-5 lg:grid-cols-[190px_minmax(0,1fr)_auto] lg:items-center lg:p-6">
                            <div className="food-image-frame h-44 w-full overflow-hidden rounded-[1.6rem] bg-stone-100 lg:h-40">
                              {product.image_url ? (
                                <img src={product.image_url} alt={product.name} className="food-image" />
                              ) : (
                                <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,_#fed7aa,_#ffedd5)] text-sm font-semibold text-orange-700">
                                  Imagem em breve
                                </div>
                              )}
                            </div>

                            <div className="flex flex-1 flex-col justify-between gap-4">
                              <div>
                                <div className="flex flex-wrap items-start gap-3">
                                  <span
                                    className="rounded-full px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.16em]"
                                    style={{
                                      backgroundColor: hasPromo ? 'rgba(200, 135, 63, 0.14)' : 'rgba(234, 217, 192, 0.46)',
                                      color: 'var(--brand)',
                                    }}
                                  >
                                    {hasPromo ? 'Oferta da casa' : 'Pedido online'}
                                  </span>
                                </div>
                                <div className="mt-4 flex items-start justify-between gap-4">
                                  <h3
                                    className="max-w-[14ch] text-[clamp(1.9rem,3vw,2.4rem)] leading-none tracking-[-0.04em]"
                                    style={{ color: 'var(--ink-strong)', fontFamily: 'var(--font-display)' }}
                                  >
                                    {product.name}
                                  </h3>
                                </div>
                                <p className="mt-4 text-sm leading-7" style={{ color: 'var(--ink-muted)' }}>
                                  {product.description?.trim() || 'Prato disponível para pedido online.'}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-col justify-between gap-5 lg:min-w-[210px] lg:items-end">
                              <div
                                className="rounded-[1.6rem] border px-5 py-4 text-left lg:text-right"
                                style={{ borderColor: 'rgba(75, 46, 35, 0.1)', backgroundColor: 'rgba(255,255,255,0.58)' }}
                              >
                                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em]" style={{ color: 'rgba(53, 39, 34, 0.52)' }}>
                                  Valor
                                </p>
                                {product.promo_price ? (
                                  <p className="mt-2 text-xs line-through" style={{ color: 'var(--ink-muted)' }}>
                                    {formatMoney(product.price)}
                                  </p>
                                ) : null}
                                <p className="mt-1 text-[1.75rem] font-semibold leading-none" style={{ color: 'var(--brand)' }}>
                                  {formatMoney(price)}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => addProductToCart(product)}
                                className="premium-button w-full px-6 py-3 lg:w-auto"
                              >
                                Adicionar
                                <ArrowRight className="h-4 w-4" />
                              </button>
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
        </div>
      </section>

      {itemCount > 0 ? (
        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          className="premium-button fixed bottom-6 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 items-center justify-between rounded-[2rem] px-5 py-4 text-white shadow-[0_18px_50px_rgba(77,46,35,0.24)]"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <div className="text-left">
              <p className="text-sm font-semibold">{itemCount} itens no carrinho</p>
              <p className="text-xs text-stone-100/80">Resumo pronto para revisar e seguir ao checkout</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-stone-100/80">Subtotal</p>
            <p className="text-lg font-semibold">{formatMoney(total)}</p>
          </div>
        </button>
      ) : null}

      {isCartOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/60 p-4 backdrop-blur-sm md:items-center">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-[2rem] bg-[var(--page-bg-soft)] shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-5" style={{ borderColor: 'var(--line)' }}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--brand)' }}>
                  Carrinho
                </p>
                <h2
                  className="mt-1 text-[2.4rem] leading-none tracking-[-0.05em]"
                  style={{ color: 'var(--ink-strong)', fontFamily: 'var(--font-display)' }}
                >
                  Seu pedido
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="rounded-full border px-3 py-2 text-sm font-medium hover:bg-white/70"
                style={{ borderColor: 'var(--line)', color: 'var(--ink-muted)' }}
              >
                Fechar
              </button>
            </div>

            <div className="max-h-[52vh] space-y-4 overflow-y-auto px-6 py-5">
              {cartItems.length === 0 ? (
                <div className="soft-card rounded-[1.5rem] p-6 text-center">Seu carrinho ainda está vazio.</div>
              ) : (
                cartItems.map((item) => (
                  <div key={item.id} className="soft-card flex items-start justify-between gap-4 rounded-[1.5rem] p-4">
                    <div className="flex gap-4">
                      <div className="h-20 w-20 overflow-hidden rounded-2xl bg-stone-100">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs font-semibold text-stone-500">Item</div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-xl leading-none tracking-[-0.03em]" style={{ color: 'var(--ink-strong)' }}>
                          {item.name}
                        </h3>
                        <p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
                          {item.description || 'Produto pronto para checkout'}
                        </p>
                        <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--brand)' }}>
                          {formatMoney(item.price)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                      <div className="flex items-center gap-2 rounded-full border px-2 py-1" style={{ borderColor: 'var(--line)' }}>
                        <button
                          type="button"
                          onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                          className="rounded-full p-1 hover:bg-black/5"
                          style={{ color: 'var(--brand)' }}
                          aria-label={`Remover uma unidade de ${item.name}`}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="min-w-6 text-center text-sm font-semibold">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                          className="rounded-full p-1 hover:bg-black/5"
                          style={{ color: 'var(--brand)' }}
                          aria-label={`Adicionar uma unidade de ${item.name}`}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--ink-strong)' }}>
                        {formatMoney(item.price * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div
              className="border-t px-6 py-5"
              style={{ borderColor: 'var(--line)', backgroundColor: 'rgba(255,250,244,0.52)' }}
            >
              <div className="flex items-center justify-between text-sm" style={{ color: 'var(--ink-muted)' }}>
                <span>Subtotal</span>
                <span className="font-semibold" style={{ color: 'var(--ink-strong)' }}>
                  {formatMoney(total)}
                </span>
              </div>
              <p className="mt-2 text-xs" style={{ color: 'var(--ink-muted)' }}>
                Taxa de entrega, descontos e valor final são confirmados antes da conclusão do pedido.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="rounded-2xl border px-4 py-3 text-sm font-semibold hover:bg-white"
                  style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
                >
                  Continuar comprando
                </button>
                <Link
                  href="/checkout"
                  onClick={() => setIsCartOpen(false)}
                  className={`premium-button inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                    cartItems.length === 0 ? 'pointer-events-none opacity-50' : ''
                  }`}
                >
                  Continuar para o checkout
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

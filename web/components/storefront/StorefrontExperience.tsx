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
    <main className="page-shell pt-28 text-stone-900">
      <StorefrontRestaurantSync
        restaurant={{
          id: restaurant.id,
          slug: restaurant.slug,
          name: restaurant.name,
        }}
      />

      <section className="relative flex min-h-[88vh] items-end overflow-hidden">
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
              'linear-gradient(90deg, rgba(18, 12, 10, 0.86) 0%, rgba(18, 12, 10, 0.58) 44%, rgba(18, 12, 10, 0.34) 100%)',
          }}
        />
        <div className="hero-orb absolute -left-10 top-40 h-48 w-48 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(200, 135, 63, 0.24)' }} />
        <div className="hero-orb absolute bottom-24 right-12 h-64 w-64 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(111, 143, 114, 0.18)', animationDelay: '1.5s' }} />

        <div className="content-shell relative z-10 w-full pb-14 sm:pb-18 lg:pb-24">
          <div className="grid items-end gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.34fr)] lg:gap-10">
            <div className="max-w-4xl text-white">
              <div
                className="hero-reveal inline-flex items-center gap-3 rounded-full px-4 py-2"
                style={{
                  backgroundColor: 'rgba(255, 250, 244, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                }}
              >
                <span className="text-[0.72rem] font-semibold uppercase tracking-[0.3em] text-white/88">
                  Pedido online oficial
                </span>
              </div>

              <div className="hero-reveal hero-reveal-delay mt-8 max-w-4xl">
                <span className="mb-4 block text-sm font-semibold uppercase tracking-[0.28em] text-white/58">
                  Cardápio da casa
                </span>
                <h1
                  className="max-w-[12ch] text-[clamp(4rem,9vw,8rem)] font-semibold leading-[0.92] tracking-[-0.055em]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {restaurant.name}
                </h1>
                <p className="mt-7 max-w-2xl text-[clamp(1.05rem,1.8vw,1.28rem)] leading-8 text-white/80 sm:leading-9">
                  Escolha seus pratos, monte o carrinho e finalize o pedido em poucos passos. Antes da confirmação,
                  revisamos todas as informações para que você siga com tranquilidade.
                </p>
              </div>

              <div className="hero-reveal hero-reveal-delay mt-10 flex flex-col items-start gap-4 sm:flex-row">
                <button type="button" onClick={() => setIsCartOpen(true)} className="premium-button px-8 py-4 sm:w-auto">
                  Ver carrinho
                  <ShoppingBag className="h-4 w-4" />
                </button>
                <a
                  href={`https://wa.me/5515991442274?text=${encodeURIComponent(`Ola! Gostaria de pedir na loja ${restaurant.name}.`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="premium-button premium-button--ghost px-8 py-4 text-white sm:w-auto"
                  style={{ color: 'white' }}
                >
                  <MessageCircle className="h-5 w-5" />
                  WhatsApp
                </a>
              </div>

              <div className="hero-reveal hero-reveal-delay mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-white/14 pt-6 text-sm text-white/72">
                <span>{categories.length} categorias disponíveis</span>
                <span className="hidden h-1.5 w-1.5 rounded-full bg-white/28 sm:block" />
                <span>{itemCount} itens no carrinho atual</span>
              </div>
            </div>

            <div className="hidden gap-6 text-white/84 lg:grid">
              <div className="border-t border-white/14 pt-5">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.26em] text-white/48">Receitas da casa</p>
                <p className="mt-3 text-lg leading-8 text-white/82">
                  Pratos preparados para o dia, com apresentação caprichada e sabor de comida feita com carinho.
                </p>
              </div>
              <div className="border-t border-white/14 pt-5">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.26em] text-white/48">Pedido simples</p>
                <p className="mt-3 text-lg leading-8 text-white/82">
                  Adicione ao carrinho, revise com calma e siga para a finalização sem complicação.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell section-divider overflow-hidden" style={{ backgroundColor: 'rgba(255, 255, 255, 0.55)' }}>
        <div className="absolute left-1/2 top-30 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(200, 135, 63, 0.12)' }} />
        <div className="content-shell relative z-10">
          {categories.length === 0 ? (
            <div className="soft-card rounded-[2rem] p-8 text-center">
              <h2 className="text-[2.4rem] leading-none tracking-[-0.05em]" style={{ color: 'var(--ink-strong)', fontFamily: 'var(--font-display)' }}>
                Cardápio em atualização.
              </h2>
              <p className="mt-4 text-base leading-7" style={{ color: 'var(--ink-muted)' }}>
                Estamos preparando novidades para você. Volte em instantes para conferir os pratos disponíveis.
              </p>
            </div>
          ) : (
            <div className="space-y-10">
              <div className="section-intro lg:grid-cols-[minmax(0,0.9fr)_minmax(0,0.7fr)] lg:items-end lg:justify-between">
                <div>
                  <span className="section-kicker">Cardápio em destaque</span>
                  <h2 className="section-title mt-4">Pratos com cara de favoritos instantâneos.</h2>
                </div>
                <p className="section-copy lg:justify-self-end">
                  Explore as categorias, escolha seus pratos preferidos e monte seu pedido com calma.
                </p>
              </div>

              {categories.map((category) => (
                <section key={category.id} className="space-y-4">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--brand)' }}>
                        Categoria
                      </p>
                      <h2
                        className="mt-2 text-[2.4rem] leading-none tracking-[-0.045em]"
                        style={{ color: 'var(--ink-strong)', fontFamily: 'var(--font-display)' }}
                      >
                        {category.name}
                      </h2>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                      {category.products.length} itens
                    </p>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    {category.products.map((product) => {
                      const price = product.promo_price ?? product.price;

                      return (
                        <article key={product.id} className="soft-card overflow-hidden rounded-[2rem] transition hover:-translate-y-0.5">
                          <div className="flex h-full flex-col gap-5 p-5 md:flex-row">
                            <div className="food-image-frame h-40 w-full overflow-hidden rounded-[1.6rem] bg-stone-100 md:h-auto md:w-48 md:flex-none">
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
                                <div className="flex items-start justify-between gap-4">
                                  <h3 className="text-[2rem] leading-none tracking-[-0.04em]" style={{ color: 'var(--ink-strong)', fontFamily: 'var(--font-display)' }}>
                                    {product.name}
                                  </h3>
                                  <div className="text-right">
                                    {product.promo_price ? (
                                      <p className="text-xs line-through" style={{ color: 'var(--ink-muted)' }}>
                                        {formatMoney(product.price)}
                                      </p>
                                    ) : null}
                                    <p className="text-lg font-semibold" style={{ color: 'var(--brand)' }}>
                                      {formatMoney(price)}
                                    </p>
                                  </div>
                                </div>
                                <p className="mt-4 text-sm leading-7" style={{ color: 'var(--ink-muted)' }}>
                                  {product.description?.trim() || 'Prato disponível para pedido online.'}
                                </p>
                              </div>

                              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <span
                                  className="rounded-full px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.16em]"
                                  style={{ backgroundColor: 'rgba(234, 217, 192, 0.46)', color: 'var(--brand)' }}
                                >
                                  Pedido online
                                </span>
                                <button type="button" onClick={() => addProductToCart(product)} className="premium-button px-6 py-3 sm:w-auto">
                                  Adicionar ao carrinho
                                  <ArrowRight className="h-4 w-4" />
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
        </div>
      </section>

      {itemCount > 0 ? (
        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          className="premium-button fixed bottom-6 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 items-center justify-between rounded-[2rem] px-5 py-4 text-white shadow-[0_18px_50px_rgba(77,46,35,0.24)]"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <div className="text-left">
              <p className="text-sm font-semibold">{itemCount} itens no carrinho</p>
              <p className="text-xs text-stone-100/80">Toque para revisar e seguir ao checkout</p>
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
                <h2 className="mt-1 text-[2.4rem] leading-none tracking-[-0.05em]" style={{ color: 'var(--ink-strong)', fontFamily: 'var(--font-display)' }}>
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
                <div className="soft-card rounded-[1.5rem] p-6 text-center">Seu carrinho ainda esta vazio.</div>
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

            <div className="border-t px-6 py-5" style={{ borderColor: 'var(--line)', backgroundColor: 'rgba(255,250,244,0.52)' }}>
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

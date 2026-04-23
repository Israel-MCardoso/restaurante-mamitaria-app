'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, MessageCircle, Minus, Plus, ShoppingBag } from 'lucide-react';
import { StorefrontRestaurantSync } from '@/components/storefront/StorefrontRestaurantSync';
import { useCart, type CartAddonSelection, type CartOptionSelection } from '@/contexts/CartContext';

interface StorefrontAddon {
  id: string;
  name: string;
  price: number;
}

interface StorefrontOptionItem {
  id: string;
  name: string;
  price_adjustment: number;
}

interface StorefrontProductOption {
  id: string;
  name: string;
  min_select: number;
  max_select: number;
  items: StorefrontOptionItem[];
}

interface StorefrontProduct {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  promo_price?: number | null;
  image_url?: string | null;
  addons?: StorefrontAddon[];
  options?: StorefrontProductOption[];
}

interface StorefrontCategory {
  id: string;
  name: string;
  products: StorefrontProduct[];
}

interface Props {
  restaurant: { id: string; slug: string; name: string; banner_url?: string | null; logo_url?: string | null };
  categories: StorefrontCategory[];
}

export function StorefrontExperience({ restaurant, categories }: Props) {
  const { items, restaurantId, setRestaurantScope, addItem, updateItemQuantity, total, itemCount } = useCart();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StorefrontProduct | null>(null);
  const [productNotes, setProductNotes] = useState('');
  const [selectedAddonQuantities, setSelectedAddonQuantities] = useState<Record<string, number>>({});
  const [selectedOptionItemIds, setSelectedOptionItemIds] = useState<Record<string, string>>({});

  useEffect(() => {
    setRestaurantScope(restaurant.id);
  }, [restaurant.id, setRestaurantScope]);

  const cartItems = useMemo(
    () => items.filter((item) => !restaurantId || restaurantId === restaurant.id),
    [items, restaurant.id, restaurantId],
  );
  const totalProducts = useMemo(() => categories.reduce((sum, category) => sum + category.products.length, 0), [categories]);
  const highlightedCategories = useMemo(() => categories.filter((category) => category.products.length > 0).slice(0, 6), [categories]);

  const selectedAddons = useMemo<CartAddonSelection[]>(() => {
    if (!selectedProduct?.addons?.length) {
      return [];
    }

    return selectedProduct.addons
      .map((addon) => {
        const quantity = selectedAddonQuantities[addon.id] ?? 0;

        if (quantity <= 0) {
          return null;
        }

        return {
          id: addon.id,
          addon_id: addon.id,
          name: addon.name,
          quantity,
          unitPrice: addon.price,
          totalPrice: addon.price * quantity,
        };
      })
      .filter((addon): addon is CartAddonSelection => addon !== null);
  }, [selectedAddonQuantities, selectedProduct]);

  const selectedOptions = useMemo<CartOptionSelection[]>(() => {
    if (!selectedProduct?.options?.length) {
      return [];
    }

    return selectedProduct.options
      .map((option) => {
        const selectedItemId = selectedOptionItemIds[option.id];

        if (!selectedItemId) {
          return null;
        }

        const selectedItem = option.items.find((item) => item.id === selectedItemId);

        if (!selectedItem) {
          return null;
        }

        return {
          option_id: option.id,
          option_name: option.name,
          option_item_id: selectedItem.id,
          option_item_name: selectedItem.name,
          priceAdjustment: selectedItem.price_adjustment,
        };
      })
      .filter((option): option is CartOptionSelection => option !== null);
  }, [selectedOptionItemIds, selectedProduct]);

  const requiredOptions = useMemo(
    () => (selectedProduct?.options ?? []).filter((option) => option.min_select > 0),
    [selectedProduct],
  );
  const missingRequiredOptions = useMemo(
    () => requiredOptions.some((option) => !selectedOptionItemIds[option.id]),
    [requiredOptions, selectedOptionItemIds],
  );
  const configuredBasePrice = useMemo(
    () => (selectedProduct ? selectedProduct.promo_price ?? selectedProduct.price : 0),
    [selectedProduct],
  );
  const configuredUnitPrice = useMemo(
    () =>
      configuredBasePrice +
      selectedAddons.reduce((sum, addon) => sum + addon.totalPrice, 0) +
      selectedOptions.reduce((sum, option) => sum + option.priceAdjustment, 0),
    [configuredBasePrice, selectedAddons, selectedOptions],
  );

  const openConfigurator = (product: StorefrontProduct) => {
    setSelectedProduct(product);
    setProductNotes('');
    setSelectedAddonQuantities({});
    setSelectedOptionItemIds({});
  };

  const closeConfigurator = () => {
    setSelectedProduct(null);
    setProductNotes('');
    setSelectedAddonQuantities({});
    setSelectedOptionItemIds({});
  };

  const changeAddonQuantity = (addonId: string, nextQuantity: number) => {
    setSelectedAddonQuantities((current) => {
      if (nextQuantity <= 0) {
        const next = { ...current };
        delete next[addonId];
        return next;
      }

      return { ...current, [addonId]: nextQuantity };
    });
  };

  const selectOptionItem = (optionId: string, optionItemId: string) => {
    setSelectedOptionItemIds((current) => ({
      ...current,
      [optionId]: optionItemId,
    }));
  };

  const addConfiguredProductToCart = () => {
    if (!selectedProduct || missingRequiredOptions) {
      return;
    }

    const notes = productNotes.trim() ? productNotes.trim() : null;
    addItem({
      cartKey: buildCartKey(selectedProduct.id, notes, selectedAddons, selectedOptions),
      id: selectedProduct.id,
      name: selectedProduct.name,
      basePrice: configuredBasePrice,
      price: configuredUnitPrice,
      quantity: 1,
      notes,
      addons: selectedAddons,
      options: selectedOptions,
      imageUrl: selectedProduct.image_url,
      description: selectedProduct.description,
    });
    closeConfigurator();
    setIsCartOpen(true);
  };

  return (
    <main className="page-shell pt-10 text-stone-900">
      <StorefrontRestaurantSync restaurant={{ id: restaurant.id, slug: restaurant.slug, name: restaurant.name }} />

      <section className="section-shell pt-6">
        <div className="content-shell">
          <div className="overflow-hidden rounded-[2.7rem] border" style={{ borderColor: 'rgba(201, 139, 100, 0.16)', boxShadow: '0 28px 80px rgba(77, 46, 35, 0.12)' }}>
            <div className="relative min-h-[320px] overflow-hidden">
              <div className="absolute inset-0" style={{ backgroundImage: restaurant.banner_url ? `url('${restaurant.banner_url}')` : "url('https://images.unsplash.com/photo-1621179816782-1c39a6583fbc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxicmF6aWxpYW4lMjBmZWlqb2FkYSUyMGZvb2R8ZW58MXx8fHwxNzc1NzU3MTcxfDA&ixlib=rb-4.1.0&q=80&w=1600')", backgroundSize: 'cover', backgroundPosition: 'center' }} />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(115deg, rgba(22,14,11,0.84) 0%, rgba(22,14,11,0.63) 48%, rgba(22,14,11,0.22) 100%)' }} />
              <div className="absolute inset-x-0 bottom-0 h-32" style={{ background: 'linear-gradient(180deg, rgba(22,14,11,0) 0%, rgba(22,14,11,0.38) 100%)' }} />
              <div className="content-shell relative z-10 flex min-h-[320px] items-end py-10 md:py-12">
                <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.52fr)] lg:items-end">
                  <div className="max-w-4xl text-white">
                    <div className="hero-reveal inline-flex items-center gap-3 rounded-full px-4 py-2" style={{ backgroundColor: 'rgba(255,250,244,0.08)', border: '1px solid rgba(255,255,255,0.16)' }}>
                      <span className="text-[0.72rem] font-semibold uppercase tracking-[0.3em] text-white/88">Loja da casa</span>
                    </div>
                    <div className="hero-reveal hero-reveal-delay mt-6 max-w-4xl">
                      <span className="mb-4 block text-sm font-semibold uppercase tracking-[0.28em] text-white/58">Cardapio online</span>
                      <h1 className="max-w-[12ch] text-[clamp(3rem,6vw,5.1rem)] font-semibold leading-[0.94] tracking-[-0.055em]" style={{ fontFamily: 'var(--font-display)' }}>{restaurant.name}</h1>
                      <p className="mt-5 max-w-2xl text-[clamp(1rem,1.7vw,1.14rem)] leading-8 text-white/78">Escolha com calma, monte seu pedido e avance para o checkout com a mesma atmosfera acolhedora da marca.</p>
                    </div>
                  </div>
                  <div className="premium-surface hero-reveal rounded-[2rem] p-6 text-left" style={{ backgroundColor: 'rgba(255,250,244,0.78)' }}>
                    <div className="grid gap-5">
                      <div>
                        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--brand)' }}>Compra pratica</p>
                        <p className="mt-3 text-sm leading-7" style={{ color: 'var(--ink-muted)' }}>O cardapio foi organizado para facilitar a escolha, destacar os pratos certos e levar voce ao checkout sem ruido.</p>
                      </div>
                      <div className="grid gap-3 text-sm" style={{ color: 'var(--ink-muted)' }}>
                        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--line)' }}><span>Categorias ativas</span><strong style={{ color: 'var(--ink-strong)' }}>{categories.length}</strong></div>
                        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--line)' }}><span>Pratos disponiveis</span><strong style={{ color: 'var(--ink-strong)' }}>{totalProducts}</strong></div>
                        <div className="flex items-center justify-between"><span>Itens no carrinho</span><strong style={{ color: 'var(--ink-strong)' }}>{itemCount}</strong></div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button type="button" onClick={() => setIsCartOpen(true)} className="premium-button px-6 py-3 sm:w-auto">Ver carrinho<ShoppingBag className="h-4 w-4" /></button>
                        <a href={`https://wa.me/5515991442274?text=${encodeURIComponent(`Ola! Gostaria de pedir na loja ${restaurant.name}.`)}`} target="_blank" rel="noreferrer" className="rounded-full border px-6 py-3 text-center text-sm font-semibold transition hover:bg-white" style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}><span className="inline-flex items-center gap-2"><MessageCircle className="h-4 w-4" />WhatsApp</span></a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell section-divider overflow-hidden pt-10" style={{ backgroundColor: 'rgba(255,255,255,0.55)' }}>
        <div className="absolute left-1/2 top-30 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(200,135,63,0.12)' }} />
        <div className="content-shell relative z-10">
          {highlightedCategories.length > 0 ? (
            <div className="mb-10 flex flex-wrap items-center gap-3 border-b pb-8" style={{ borderColor: 'rgba(75,46,35,0.1)' }}>
              <span className="text-xs font-semibold uppercase tracking-[0.26em]" style={{ color: 'rgba(53,39,34,0.58)' }}>Navegue por</span>
              {highlightedCategories.map((category) => <a key={category.id} href={`#category-${category.id}`} className="rounded-full border px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 hover:bg-white" style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}>{category.name}</a>)}
            </div>
          ) : null}

          {categories.length === 0 ? (
            <div className="soft-card rounded-[2rem] p-8 text-center">
              <h2 className="text-[2.4rem] leading-none tracking-[-0.05em]" style={{ color: 'var(--ink-strong)', fontFamily: 'var(--font-display)' }}>Cardapio em atualizacao.</h2>
              <p className="mt-4 text-base leading-7" style={{ color: 'var(--ink-muted)' }}>Estamos preparando novidades para voce. Volte em instantes para conferir os pratos disponiveis.</p>
            </div>
          ) : (
            <div className="space-y-14">
              <div className="section-intro border-b pb-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,0.7fr)] lg:items-end lg:justify-between" style={{ borderColor: 'rgba(75,46,35,0.1)' }}>
                <div><span className="section-kicker">Cardapio em destaque</span><h2 className="section-title mt-4">Pratos com cara de favoritos instantaneos.</h2></div>
                <p className="section-copy lg:justify-self-end">Explore as categorias, escolha seus pratos preferidos e monte seu pedido com uma navegacao mais clara, elegante e objetiva.</p>
              </div>

              {categories.map((category) => (
                <section key={category.id} id={`category-${category.id}`} className="scroll-mt-28 border-t pt-8" style={{ borderColor: 'rgba(75,46,35,0.08)' }}>
                  <div className="grid gap-6 border-b pb-6 md:grid-cols-[minmax(0,1fr)_auto]" style={{ borderColor: 'rgba(75,46,35,0.08)' }}>
                    <div className="max-w-2xl">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--brand)' }}>Categoria</p>
                      <h2 className="mt-3 text-[clamp(2.35rem,4vw,3.2rem)] leading-none tracking-[-0.045em]" style={{ color: 'var(--ink-strong)', fontFamily: 'var(--font-display)' }}>{category.name}</h2>
                      <p className="mt-3 max-w-xl text-sm leading-7" style={{ color: 'var(--ink-muted)' }}>Selecao pensada para manter ritmo, clareza e apetite durante toda a experiencia de compra.</p>
                    </div>
                    <div className="self-end"><p className="text-sm font-medium" style={{ color: 'var(--ink-muted)' }}>{category.products.length} {category.products.length === 1 ? 'item disponivel' : 'itens disponiveis'}</p></div>
                  </div>

                  <div className="mt-8 grid gap-5">
                    {category.products.map((product) => {
                      const price = product.promo_price ?? product.price;
                      const hasPromo = Boolean(product.promo_price);
                      return (
                        <article key={product.id} className="group overflow-hidden rounded-[2rem] border bg-[rgba(255,251,246,0.84)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_48px_rgba(92,66,53,0.1)]" style={{ borderColor: 'rgba(75,46,35,0.1)' }}>
                          <div className="grid h-full gap-5 p-5 lg:grid-cols-[190px_minmax(0,1fr)_auto] lg:items-center lg:p-6">
                            <div className="food-image-frame h-44 w-full overflow-hidden rounded-[1.6rem] bg-stone-100 lg:h-40">
                              {product.image_url ? <img src={product.image_url} alt={product.name} className="food-image block h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,_#fed7aa,_#ffedd5)] text-sm font-semibold text-orange-700">Imagem em breve</div>}
                            </div>
                            <div className="flex flex-1 flex-col justify-between gap-4">
                              <div>
                                <div className="flex flex-wrap items-start gap-3">
                                  <span className="rounded-full px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.16em]" style={{ backgroundColor: hasPromo ? 'rgba(200,135,63,0.14)' : 'rgba(234,217,192,0.46)', color: 'var(--brand)' }}>{hasPromo ? 'Oferta da casa' : 'Pedido online'}</span>
                                  {product.addons?.length ? <span className="rounded-full px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.16em]" style={{ backgroundColor: 'rgba(111,143,114,0.12)', color: '#4c6f4f' }}>Com adicionais</span> : null}
                                  {product.options?.length ? <span className="rounded-full px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.16em]" style={{ backgroundColor: 'rgba(77,110,143,0.12)', color: '#456480' }}>Com escolhas obrigatorias</span> : null}
                                </div>
                                <h3 className="mt-4 max-w-[14ch] text-[clamp(1.9rem,3vw,2.4rem)] leading-none tracking-[-0.04em]" style={{ color: 'var(--ink-strong)', fontFamily: 'var(--font-display)' }}>{product.name}</h3>
                                <p className="mt-4 text-sm leading-7" style={{ color: 'var(--ink-muted)' }}>{product.description?.trim() || 'Prato disponivel para pedido online.'}</p>
                              </div>
                            </div>
                            <div className="flex flex-col justify-between gap-5 lg:min-w-[210px] lg:items-end">
                              <div className="rounded-[1.6rem] border px-5 py-4 text-left lg:text-right" style={{ borderColor: 'rgba(75,46,35,0.1)', backgroundColor: 'rgba(255,255,255,0.58)' }}>
                                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em]" style={{ color: 'rgba(53,39,34,0.52)' }}>Valor</p>
                                {product.promo_price ? <p className="mt-2 text-xs line-through" style={{ color: 'var(--ink-muted)' }}>{formatMoney(product.price)}</p> : null}
                                <p className="mt-1 text-[1.75rem] font-semibold leading-none" style={{ color: 'var(--brand)' }}>{formatMoney(price)}</p>
                              </div>
                              <button type="button" onClick={() => openConfigurator(product)} className="premium-button w-full px-6 py-3 lg:w-auto">Adicionar<ArrowRight className="h-4 w-4" /></button>
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

      {itemCount > 0 ? <button type="button" onClick={() => setIsCartOpen(true)} className="premium-button fixed bottom-6 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 items-center justify-between rounded-[2rem] px-5 py-4 text-white shadow-[0_18px_50px_rgba(77,46,35,0.24)]"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10"><ShoppingBag className="h-5 w-5" /></span><div className="text-left"><p className="text-sm font-semibold">{itemCount} itens no carrinho</p><p className="text-xs text-stone-100/80">Resumo pronto para revisar e seguir ao checkout</p></div></div><div className="text-right"><p className="text-sm text-stone-100/80">Subtotal</p><p className="text-lg font-semibold">{formatMoney(total)}</p></div></button> : null}

      {selectedProduct ? (
        <ProductConfigurator
          product={selectedProduct}
          notes={productNotes}
          setNotes={setProductNotes}
          selectedAddons={selectedAddons}
          selectedOptions={selectedOptions}
          selectedAddonQuantities={selectedAddonQuantities}
          selectedOptionItemIds={selectedOptionItemIds}
          configuredBasePrice={configuredBasePrice}
          configuredUnitPrice={configuredUnitPrice}
          missingRequiredOptions={missingRequiredOptions}
          changeAddonQuantity={changeAddonQuantity}
          selectOptionItem={selectOptionItem}
          onClose={closeConfigurator}
          onConfirm={addConfiguredProductToCart}
        />
      ) : null}
      {isCartOpen ? <CartDrawer items={cartItems} total={total} onClose={() => setIsCartOpen(false)} updateItemQuantity={updateItemQuantity} /> : null}
    </main>
  );
}

function ProductConfigurator({
  product,
  notes,
  setNotes,
  selectedAddons,
  selectedOptions,
  selectedAddonQuantities,
  selectedOptionItemIds,
  configuredBasePrice,
  configuredUnitPrice,
  missingRequiredOptions,
  changeAddonQuantity,
  selectOptionItem,
  onClose,
  onConfirm,
}: {
  product: StorefrontProduct;
  notes: string;
  setNotes: (value: string) => void;
  selectedAddons: CartAddonSelection[];
  selectedOptions: CartOptionSelection[];
  selectedAddonQuantities: Record<string, number>;
  selectedOptionItemIds: Record<string, string>;
  configuredBasePrice: number;
  configuredUnitPrice: number;
  missingRequiredOptions: boolean;
  changeAddonQuantity: (addonId: string, quantity: number) => void;
  selectOptionItem: (optionId: string, optionItemId: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-stone-950/60 backdrop-blur-sm">
      <div className="flex min-h-full items-end justify-center p-4 md:items-center">
        <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] bg-[var(--page-bg-soft)] shadow-2xl">
          <div className="flex items-center justify-between border-b px-6 py-5" style={{ borderColor: 'var(--line)' }}><div><p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--brand)' }}>Personalize o pedido</p><h2 className="mt-1 text-[2.4rem] leading-none tracking-[-0.05em]" style={{ color: 'var(--ink-strong)', fontFamily: 'var(--font-display)' }}>{product.name}</h2></div><button type="button" onClick={onClose} className="rounded-full border px-3 py-2 text-sm font-medium hover:bg-white/70" style={{ borderColor: 'var(--line)', color: 'var(--ink-muted)' }}>Fechar</button></div>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="food-image-frame h-52 w-full overflow-hidden rounded-[1.6rem] bg-stone-100">{product.image_url ? <img src={product.image_url} alt={product.name} className="food-image block h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,_#fed7aa,_#ffedd5)] text-sm font-semibold text-orange-700">Imagem em breve</div>}</div>
              <div className="soft-card rounded-[1.5rem] p-5"><p className="text-sm leading-7" style={{ color: 'var(--ink-muted)' }}>{product.description?.trim() || 'Ajuste observacoes e adicionais antes de enviar para o carrinho.'}</p><div className="mt-4 flex items-center justify-between"><span className="text-sm" style={{ color: 'var(--ink-muted)' }}>Preco base</span><strong style={{ color: 'var(--ink-strong)' }}>{formatMoney(configuredBasePrice)}</strong></div><div className="mt-2 flex items-center justify-between"><span className="text-sm" style={{ color: 'var(--ink-muted)' }}>Total configurado</span><strong style={{ color: 'var(--brand)' }}>{formatMoney(configuredUnitPrice)}</strong></div></div>
            </div>

            <div className="soft-card rounded-[1.5rem] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--ink-strong)' }}>Escolhas obrigatorias</p>
                  <p className="mt-1 text-sm leading-6" style={{ color: 'var(--ink-muted)' }}>Selecione uma opcao em cada grupo obrigatorio antes de adicionar ao carrinho.</p>
                </div>
                {product.options?.length ? <span className="rounded-full px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em]" style={{ backgroundColor: 'rgba(200, 135, 63, 0.12)', color: 'var(--brand)' }}>Obrigatorio</span> : null}
              </div>
              {product.options?.length ? (
                <div className="mt-5 grid gap-4">
                  {product.options.map((option) => {
                    const selectedItemId = selectedOptionItemIds[option.id] ?? null;
                    const currentCount = selectedItemId ? 1 : 0;

                    return (
                      <div key={option.id} className="rounded-[1.25rem] border p-4" style={{ borderColor: 'var(--line)', backgroundColor: 'rgba(255,255,255,0.62)' }}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold" style={{ color: 'var(--ink-strong)' }}>{option.name}</p>
                            <p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>OBRIGATORIO</p>
                          </div>
                          <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: currentCount === option.min_select ? 'rgba(52,157,89,0.12)' : 'rgba(212,24,61,0.08)', color: currentCount === option.min_select ? '#237241' : '#b3261e' }}>{currentCount}/{option.max_select}</span>
                        </div>
                        <div className="mt-4 grid gap-3">
                          {option.items.map((item) => {
                            const selected = selectedItemId === item.id;
                            return (
                              <button key={item.id} type="button" onClick={() => selectOptionItem(option.id, item.id)} className="flex items-center justify-between gap-4 rounded-[1.1rem] border px-4 py-3 text-left transition" style={{ borderColor: selected ? 'rgba(200,135,63,0.5)' : 'var(--line)', backgroundColor: selected ? 'rgba(200,135,63,0.12)' : 'rgba(255,255,255,0.62)' }}>
                                <div className="min-w-0">
                                  <p className="font-semibold" style={{ color: 'var(--ink-strong)' }}>{item.name}</p>
                                  <p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>{item.price_adjustment > 0 ? `${formatMoney(item.price_adjustment)} adicional` : 'Sem custo adicional'}</p>
                                </div>
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: selected ? 'rgba(200,135,63,0.45)' : 'var(--line)', color: selected ? 'var(--brand)' : 'var(--ink-muted)' }}>{selected ? <Check className="h-4 w-4" /> : <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'currentColor' }} />}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-5 rounded-[1.25rem] border p-4 text-sm leading-6" style={{ borderColor: 'var(--line)', color: 'var(--ink-muted)' }}>Este prato nao tem grupos obrigatorios cadastrados no momento.</div>
              )}
              {selectedOptions.length ? <div className="mt-4 text-sm" style={{ color: 'var(--ink-muted)' }}>{selectedOptions.map((option) => <p key={`${option.option_id}-${option.option_item_id}`}>{option.option_name}: {option.option_item_name}{option.priceAdjustment > 0 ? ` (${formatMoney(option.priceAdjustment)})` : ''}</p>)}</div> : null}
            </div>

            <div className="soft-card rounded-[1.5rem] p-5"><label className="grid gap-3"><span className="text-sm font-semibold" style={{ color: 'var(--ink-strong)' }}>Observacoes do cliente</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: sem cebola, ponto da carne, embalagem separada..." rows={4} className="rounded-[1.25rem] border bg-white/70 px-4 py-3 outline-none transition focus:border-[var(--gold)]" style={{ borderColor: 'var(--line)', resize: 'vertical', color: 'var(--ink)' }} /></label></div>

            <div className="soft-card rounded-[1.5rem] p-5">
              <p className="text-sm font-semibold" style={{ color: 'var(--ink-strong)' }}>Adicionais disponiveis</p>
              <p className="mt-1 text-sm leading-6" style={{ color: 'var(--ink-muted)' }}>Se houver complementos para este prato, selecione aqui antes de adicionar ao carrinho.</p>
              {product.addons?.length ? <div className="mt-5 grid gap-3">{product.addons.map((addon) => { const quantity = selectedAddonQuantities[addon.id] ?? 0; return <div key={addon.id} className="flex items-center justify-between gap-4 rounded-[1.25rem] border px-4 py-3" style={{ borderColor: 'var(--line)', backgroundColor: 'rgba(255,255,255,0.62)' }}><div className="min-w-0"><p className="font-semibold" style={{ color: 'var(--ink-strong)' }}>{addon.name}</p><p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>{formatMoney(addon.price)} por unidade</p></div><div className="flex items-center gap-3"><button type="button" onClick={() => changeAddonQuantity(addon.id, quantity - 1)} className="rounded-full border p-2 hover:bg-white" style={{ borderColor: 'var(--line)', color: 'var(--brand)' }}><Minus className="h-4 w-4" /></button><span className="min-w-5 text-center text-sm font-semibold" style={{ color: 'var(--ink-strong)' }}>{quantity}</span><button type="button" onClick={() => changeAddonQuantity(addon.id, quantity + 1)} className="rounded-full border p-2 hover:bg-white" style={{ borderColor: 'var(--line)', color: 'var(--brand)' }}><Plus className="h-4 w-4" /></button></div></div>; })}</div> : <div className="mt-5 rounded-[1.25rem] border p-4 text-sm leading-6" style={{ borderColor: 'var(--line)', color: 'var(--ink-muted)' }}>Este prato nao tem adicionais cadastrados no momento.</div>}
              {selectedAddons.length ? <div className="mt-4 text-sm" style={{ color: 'var(--ink-muted)' }}>{selectedAddons.map((addon) => <p key={addon.addon_id}>+ {addon.name} x{addon.quantity} ({formatMoney(addon.totalPrice)})</p>)}</div> : null}
            </div>
          </div>
          <div className="border-t px-6 py-5" style={{ borderColor: 'var(--line)', backgroundColor: 'rgba(255,250,244,0.52)' }}>
            {missingRequiredOptions ? <p className="text-sm leading-6" style={{ color: '#b3261e' }}>Selecione todas as opcoes obrigatorias para continuar.</p> : null}
            <div className="mt-3 flex items-center justify-between text-sm" style={{ color: 'var(--ink-muted)' }}><span>Total desta configuracao</span><span className="font-semibold" style={{ color: 'var(--ink-strong)' }}>{formatMoney(configuredUnitPrice)}</span></div>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]"><button type="button" onClick={onClose} className="rounded-2xl border px-4 py-3 text-sm font-semibold hover:bg-white" style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}>Continuar navegando</button><button type="button" onClick={onConfirm} disabled={missingRequiredOptions} className={`premium-button px-5 py-3 text-sm font-semibold ${missingRequiredOptions ? 'pointer-events-none opacity-50' : ''}`}>Adicionar ao carrinho<ArrowRight className="h-4 w-4" /></button></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CartDrawer({ items, total, onClose, updateItemQuantity }: {
  items: Array<{ cartKey: string; id: string; name: string; price: number; quantity: number; imageUrl?: string | null; description?: string | null; notes?: string | null; addons?: CartAddonSelection[]; options?: CartOptionSelection[] }>;
  total: number;
  onClose: () => void;
  updateItemQuantity: (cartKey: string, quantity: number) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/60 p-4 backdrop-blur-sm md:items-center">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] bg-[var(--page-bg-soft)] shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-5" style={{ borderColor: 'var(--line)' }}><div><p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--brand)' }}>Carrinho</p><h2 className="mt-1 text-[2.4rem] leading-none tracking-[-0.05em]" style={{ color: 'var(--ink-strong)', fontFamily: 'var(--font-display)' }}>Seu pedido</h2></div><button type="button" onClick={onClose} className="rounded-full border px-3 py-2 text-sm font-medium hover:bg-white/70" style={{ borderColor: 'var(--line)', color: 'var(--ink-muted)' }}>Fechar</button></div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-4 pb-4">
            {items.length === 0 ? <div className="soft-card rounded-[1.5rem] p-6 text-center">Seu carrinho ainda esta vazio.</div> : items.map((item) => (
              <div key={item.cartKey} className="soft-card rounded-[1.5rem] p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-stone-100">{item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="block h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs font-semibold text-stone-500">Item</div>}</div>
                    <div className="min-w-0"><h3 className="text-xl leading-none tracking-[-0.03em]" style={{ color: 'var(--ink-strong)' }}>{item.name}</h3><p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>{item.description || 'Produto pronto para checkout'}</p>{item.notes ? <p className="mt-2 text-sm leading-6" style={{ color: 'var(--ink-muted)' }}><strong style={{ color: 'var(--ink-strong)' }}>Obs.:</strong> {item.notes}</p> : null}{item.options?.length ? <div className="mt-2 space-y-1 text-sm" style={{ color: 'var(--ink-muted)' }}>{item.options.map((option) => <p key={`${item.cartKey}-${option.option_id}`}>{option.option_name}: {option.option_item_name}{option.priceAdjustment > 0 ? ` (${formatMoney(option.priceAdjustment)})` : ''}</p>)}</div> : null}{item.addons?.length ? <div className="mt-2 space-y-1 text-sm" style={{ color: 'var(--ink-muted)' }}>{item.addons.map((addon) => <p key={`${item.cartKey}-${addon.addon_id}`}>+ {addon.name} x{addon.quantity} ({formatMoney(addon.totalPrice)})</p>)}</div> : null}<p className="mt-3 text-sm font-semibold" style={{ color: 'var(--brand)' }}>{formatMoney(item.price)}</p></div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:min-w-[132px] sm:flex-col sm:items-end"><div className="flex items-center gap-2 rounded-full border px-2 py-1" style={{ borderColor: 'var(--line)' }}><button type="button" onClick={() => updateItemQuantity(item.cartKey, item.quantity - 1)} className="rounded-full p-1 hover:bg-black/5" style={{ color: 'var(--brand)' }}><Minus className="h-4 w-4" /></button><span className="min-w-6 text-center text-sm font-semibold">{item.quantity}</span><button type="button" onClick={() => updateItemQuantity(item.cartKey, item.quantity + 1)} className="rounded-full p-1 hover:bg-black/5" style={{ color: 'var(--brand)' }}><Plus className="h-4 w-4" /></button></div><p className="shrink-0 text-sm font-semibold" style={{ color: 'var(--ink-strong)' }}>{formatMoney(item.price * item.quantity)}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t px-6 py-5" style={{ borderColor: 'var(--line)', backgroundColor: 'rgba(255,250,244,0.52)' }}><div className="flex items-center justify-between text-sm" style={{ color: 'var(--ink-muted)' }}><span>Subtotal</span><span className="font-semibold" style={{ color: 'var(--ink-strong)' }}>{formatMoney(total)}</span></div><p className="mt-2 text-xs" style={{ color: 'var(--ink-muted)' }}>Taxa de entrega, descontos e valor final sao confirmados antes da conclusao do pedido.</p><div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]"><button type="button" onClick={onClose} className="rounded-2xl border px-4 py-3 text-sm font-semibold hover:bg-white" style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}>Continuar comprando</button><Link href="/checkout" onClick={onClose} className={`premium-button inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition ${items.length === 0 ? 'pointer-events-none opacity-50' : ''}`}>Continuar para o checkout</Link></div></div>
      </div>
    </div>
  );
}

function buildCartKey(productId: string, notes: string | null, addons: CartAddonSelection[], options: CartOptionSelection[]) {
  const normalizedAddons = [...addons].map((addon) => `${addon.addon_id}:${addon.quantity}`).sort().join('|');
  const normalizedOptions = [...options].map((option) => `${option.option_id}:${option.option_item_id}`).sort().join('|');
  return `${productId}::${notes ?? ''}::${normalizedAddons}::${normalizedOptions}`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

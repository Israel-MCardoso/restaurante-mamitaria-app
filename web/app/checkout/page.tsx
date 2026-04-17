'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, LoaderCircle, ShieldCheck, ShoppingBag } from 'lucide-react';
import type { CreateOrderRequest } from '@/lib/contracts';
import { useCart } from '@/contexts/CartContext';
import { useStorefront } from '@/contexts/StorefrontContext';
import { AppFooter, AppHeader } from '@/components/site/SiteChrome';
import {
  clearPendingOrderAttempt,
  createPublicOrder,
  getOrCreatePendingOrderAttempt,
  persistLastOrder,
  PublicOrderApiError,
  shouldResetPendingOrderAttempt,
} from '@/lib/orders/public';

export default function CheckoutPage() {
  const { items, clearCart, total, itemCount } = useCart();
  const { restaurant } = useStorefront();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    street: '',
    number: '',
    city: '',
    paymentMethod: 'pix',
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (items.length === 0 || isSubmitting) {
      return;
    }

    if (!restaurant?.id) {
      setFeedbackMessage('Volte ao cardápio e escolha seus itens novamente antes de finalizar.');
      return;
    }

    setIsSubmitting(true);
    setFeedbackMessage(null);

    const payload: CreateOrderRequest = {
      restaurant_id: restaurant.id,
      payment_method: normalizePaymentMethod(formData.paymentMethod),
      fulfillment_type: 'delivery',
      customer: {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || null,
      },
      delivery_address: {
        street: formData.street.trim(),
        number: formData.number.trim(),
        neighborhood: null,
        city: formData.city.trim(),
        state: null,
        zip_code: null,
        complement: null,
        reference: null,
      },
      items: items.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
        addons: normalizeAddonSelections(item.addons),
        notes: item.notes?.trim() || null,
      })),
      notes: null,
      coupon_code: null,
    };
    const requestFingerprint = JSON.stringify(payload);

    try {
      const result = await createPublicOrder(payload, getOrCreatePendingOrderAttempt(requestFingerprint));
      persistLastOrder(result.order, result.accessToken);
      clearPendingOrderAttempt();
      clearCart();
      router.push(`/order-success/${result.order.order_id}`);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to create order', error);
      }

      if (error instanceof PublicOrderApiError) {
        setFeedbackMessage(error.message);

        if (shouldResetPendingOrderAttempt(error)) {
          clearPendingOrderAttempt();
        }
      } else {
        setFeedbackMessage('Não foi possível concluir seu pedido agora. Confira sua conexão e tente novamente em instantes.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AppHeader
        backHref={restaurant?.slug ? `/${restaurant.slug}` : '/'}
        backLabel="Voltar ao cardápio"
      />
      <main className="page-shell pt-10">
        <section className="section-shell min-h-screen pb-28 lg:pb-0">
          <div className="content-shell">
            {items.length === 0 ? (
              <div className="soft-card rounded-[2rem] p-10 text-center">
                <h1 className="text-[3rem] leading-none tracking-[-0.05em]" style={{ color: 'var(--ink-strong)', fontFamily: 'var(--font-display)' }}>
                  Seu carrinho está vazio.
                </h1>
                <p className="mt-4 text-base leading-7" style={{ color: 'var(--ink-muted)' }}>
                  Adicione alguns itens antes de seguir para a finalização do pedido.
                </p>
                {restaurant?.slug ? (
                  <Link href={`/${restaurant.slug}`} className="premium-button mt-6 px-8 py-4 sm:w-auto">
                    Escolher produtos
                  </Link>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.45fr)] lg:items-start">
                <div className="soft-card rounded-[2rem] p-7 sm:p-9">
                  <span className="section-kicker">Checkout</span>
                  <h1
                    className="mt-4 max-w-[12ch] text-[clamp(3.2rem,6vw,5rem)] leading-[0.94] tracking-[-0.05em]"
                    style={{ color: 'var(--ink-strong)', fontFamily: 'var(--font-display)' }}
                  >
                    Dados para entrega.
                  </h1>
                  <p className="mt-5 max-w-2xl text-base leading-7" style={{ color: 'var(--ink-muted)' }}>
                    Preencha seus dados para confirmar a entrega e concluir seu pedido com segurança.
                  </p>

                  <div className="mt-7 grid gap-3 sm:grid-cols-3">
                    {[
                      { icon: ClipboardList, text: 'Pedido enviado com praticidade' },
                      { icon: ShieldCheck, text: 'Valores confirmados antes da finalização' },
                      { icon: ShoppingBag, text: `${itemCount} itens no carrinho` },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.text}
                          className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm"
                          style={{ borderColor: 'var(--line)', backgroundColor: 'rgba(255,250,244,0.52)', color: 'var(--ink-muted)' }}
                        >
                          <Icon className="h-4 w-4 shrink-0" style={{ color: 'var(--brand)' }} />
                          <span>{item.text}</span>
                        </div>
                      );
                    })}
                  </div>

                  <form id="checkout-form" className="mt-9 grid gap-7" onSubmit={handleSubmit}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label="Nome"
                        value={formData.name}
                        onChange={(value) => setFormData((current) => ({ ...current, name: value }))}
                        autoComplete="name"
                      />
                      <Field
                        label="Telefone"
                        value={formData.phone}
                        onChange={(value) => setFormData((current) => ({ ...current, phone: value }))}
                        autoComplete="tel"
                      />
                    </div>

                    <Field
                        label="E-mail para receber o Pix"
                      value={formData.email}
                      onChange={(value) => setFormData((current) => ({ ...current, email: value }))}
                      type="email"
                      autoComplete="email"
                    />

                    <div className="grid gap-4 sm:grid-cols-[1fr_0.45fr]">
                      <Field
                        label="Rua"
                        value={formData.street}
                        onChange={(value) => setFormData((current) => ({ ...current, street: value }))}
                        autoComplete="address-line1"
                      />
                      <Field
                        label="Número"
                        value={formData.number}
                        onChange={(value) => setFormData((current) => ({ ...current, number: value }))}
                        autoComplete="address-line2"
                      />
                    </div>

                    <Field
                      label="Cidade"
                      value={formData.city}
                      onChange={(value) => setFormData((current) => ({ ...current, city: value }))}
                      autoComplete="address-level2"
                    />

                    <div className="grid gap-3">
                      <span className="text-sm font-semibold" style={{ color: 'var(--ink-strong)' }}>
                        Pagamento
                      </span>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {[
                          { value: 'pix', title: 'Pix', copy: 'Receba o QR Code e o código para pagar logo após o pedido.' },
                          { value: 'cash', title: 'Dinheiro', copy: 'Pagamento na entrega.' },
                          { value: 'card', title: 'Cartão', copy: 'Pagamento na entrega.' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setFormData((current) => ({ ...current, paymentMethod: option.value }))}
                            className="rounded-[1.25rem] border p-4 text-left transition-colors"
                            style={{
                              backgroundColor:
                                formData.paymentMethod === option.value ? 'rgba(200, 135, 63, 0.14)' : 'rgba(255,250,244,0.56)',
                              borderColor:
                                formData.paymentMethod === option.value ? 'rgba(200, 135, 63, 0.5)' : 'var(--line)',
                            }}
                          >
                            <span className="block text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--brand)' }}>
                              {option.title}
                            </span>
                            <span className="mt-2 block text-sm leading-6" style={{ color: 'var(--ink-muted)' }}>
                              {option.copy}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {feedbackMessage ? (
                      <div
                        className="rounded-[1.25rem] border p-4"
                        style={{ borderColor: 'rgba(212, 24, 61, 0.28)', backgroundColor: 'rgba(212, 24, 61, 0.05)' }}
                      >
                        <p className="text-sm leading-6" style={{ color: '#d4183d' }}>
                          {feedbackMessage}
                        </p>
                      </div>
                    ) : null}

                    <button type="submit" className="premium-button px-8 py-4 sm:w-auto" disabled={isSubmitting || items.length === 0}>
                      {isSubmitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ClipboardList className="h-5 w-5" />}
                      {isSubmitting ? 'Confirmando pedido...' : 'Finalizar pedido'}
                    </button>
                  </form>
                </div>

                <aside className="soft-card sticky top-32 rounded-[2rem] p-6">
                  <span className="section-kicker">Resumo</span>
                  <div className="mt-5 grid gap-4">
                    {items.map((item) => (
                      <div key={item.cartKey} className="flex gap-3 border-b pb-4" style={{ borderColor: 'var(--line)' }}>
                        <div className="h-16 w-16 overflow-hidden rounded-[1rem] bg-white/60">
                          {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" /> : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold leading-5" style={{ color: 'var(--ink-strong)' }}>
                            {item.name}
                          </p>
                          <p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>
                            {item.quantity} x {formatMoney(item.price)}
                          </p>
                          {item.notes ? (
                            <p className="mt-1 text-sm leading-6" style={{ color: 'var(--ink-muted)' }}>
                              <strong style={{ color: 'var(--ink-strong)' }}>Obs.:</strong> {item.notes}
                            </p>
                          ) : null}
                          {item.addons?.length ? (
                            <div className="mt-1 space-y-1 text-sm" style={{ color: 'var(--ink-muted)' }}>
                              {item.addons.map((addon) => (
                                <p key={`${item.cartKey}-${addon.addon_id}`}>
                                  + {addon.name} x{addon.quantity}
                                </p>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <strong className="whitespace-nowrap text-sm" style={{ color: 'var(--ink-strong)' }}>
                          {formatMoney(item.price * item.quantity)}
                        </strong>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 grid gap-3 text-sm">
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--ink-muted)' }}>Subtotal dos itens</span>
                      <strong>{formatMoney(total)}</strong>
                    </div>
                    <div className="flex justify-between border-t pt-4 text-lg" style={{ borderColor: 'var(--line)', color: 'var(--ink-strong)' }}>
                      <span>Total final</span>
                      <strong>Calculado na confirmação</strong>
                    </div>
                  </div>

                  <div className="mt-5 rounded-[1.25rem] border p-4 text-sm leading-6" style={{ borderColor: 'var(--line)', backgroundColor: 'rgba(255,250,244,0.52)', color: 'var(--ink-muted)' }}>
                    Taxa de entrega, descontos e valor final são confirmados antes do seu pedido ser concluído.
                  </div>
                </aside>
              </div>
            )}
          </div>
        </section>
      </main>
      <AppFooter />
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold" style={{ color: 'var(--ink-strong)' }}>
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        autoComplete={autoComplete}
        className="rounded-full border bg-white/60 px-4 py-3 outline-none transition focus:border-[var(--gold)]"
        style={{ borderColor: 'var(--line)' }}
      />
    </label>
  );
}

function normalizePaymentMethod(value: string): CreateOrderRequest['payment_method'] {
  if (value === 'cash' || value === 'card') {
    return value;
  }

  return 'pix';
}

function normalizeAddonSelections(addons: unknown) {
  if (!Array.isArray(addons) || addons.length === 0) {
    return [];
  }

  return addons
    .map((addon) => {
      if (!addon || typeof addon !== 'object') {
        return null;
      }

      const candidate = addon as { id?: string; addon_id?: string; quantity?: number };
      const addonId = candidate.addon_id ?? candidate.id;
      const quantity = Number(candidate.quantity ?? 1);

      if (!addonId || !Number.isInteger(quantity) || quantity <= 0) {
        return null;
      }

      return {
        addon_id: addonId,
        quantity,
      };
    })
    .filter((addon): addon is { addon_id: string; quantity: number } => addon !== null);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

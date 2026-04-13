'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CreateOrderRequest } from '@/lib/contracts';
import { useCart } from '@/contexts/CartContext';
import { useStorefront } from '@/contexts/StorefrontContext';
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
      setFeedbackMessage('Abra a loja novamente antes de finalizar o pedido.');
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
      console.error('Failed to create canonical order', error);

      if (error instanceof PublicOrderApiError) {
        setFeedbackMessage(error.message);

        if (shouldResetPendingOrderAttempt(error)) {
          clearPendingOrderAttempt();
        }
      } else {
        setFeedbackMessage('Erro ao processar pedido. Se a internet oscilou, tente novamente para retomar a mesma tentativa.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-600">Checkout</p>
          <h1 className="mt-2 text-3xl font-bold text-stone-950">Finalizar Pedido</h1>
          <p className="mt-2 text-sm text-stone-600">
            Revise seus itens e confirme o envio com os dados de entrega.
          </p>
        </div>
        {restaurant?.slug ? (
          <Link href={`/${restaurant.slug}`} className="text-sm font-medium text-stone-600 underline-offset-4 hover:underline">
            Voltar para a loja
          </Link>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-10 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-stone-900">Seu carrinho está vazio</h2>
          <p className="mt-3 text-sm text-stone-600">
            Adicione produtos na loja antes de seguir para o checkout.
          </p>
          {restaurant?.slug ? (
            <Link
              href={`/${restaurant.slug}`}
              className="mt-6 inline-flex rounded-2xl bg-stone-950 px-5 py-3 text-sm font-semibold text-white hover:bg-stone-800"
            >
              Escolher produtos
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <form onSubmit={handleSubmit} className="space-y-6">
            <section className="rounded-lg border bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Dados Pessoais</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <input
                  className="rounded border p-2"
                  placeholder="Nome completo"
                  required
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                />
                <input
                  className="rounded border p-2"
                  placeholder="WhatsApp/Telefone"
                  required
                  value={formData.phone}
                  onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                />
                <input
                  className="rounded border p-2 md:col-span-2"
                  placeholder="E-mail para pagamento Pix"
                  required={formData.paymentMethod === 'pix'}
                  type="email"
                  value={formData.email}
                  onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                />
              </div>
            </section>

            <section className="rounded-lg border bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Endereço de Entrega</h2>
              <div className="space-y-4">
                <input
                  className="w-full rounded border p-2"
                  placeholder="Rua / Logradouro"
                  required
                  value={formData.street}
                  onChange={(event) => setFormData({ ...formData, street: event.target.value })}
                />
                <div className="grid grid-cols-2 gap-4">
                  <input
                    className="rounded border p-2"
                    placeholder="Número"
                    required
                    value={formData.number}
                    onChange={(event) => setFormData({ ...formData, number: event.target.value })}
                  />
                  <input
                    className="rounded border p-2"
                    placeholder="Cidade"
                    required
                    value={formData.city}
                    onChange={(event) => setFormData({ ...formData, city: event.target.value })}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-lg border bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Pagamento</h2>
              <select
                className="w-full rounded border p-2"
                value={formData.paymentMethod}
                onChange={(event) => setFormData({ ...formData, paymentMethod: event.target.value })}
              >
                <option value="pix">Pix</option>
                <option value="cash">Dinheiro na entrega</option>
                <option value="card">Cartão na entrega</option>
              </select>
            </section>

            {feedbackMessage ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {feedbackMessage}
              </div>
            ) : null}

            <div className="flex items-center justify-between rounded-lg bg-gray-100 p-4">
              <div>
                <p className="text-gray-600">Total final confirmado após o envio</p>
                <p className="text-sm text-gray-500">
                  O backend recalcula subtotal, taxa e descontos antes de criar o pedido.
                </p>
              </div>
              <button
                type="submit"
                disabled={isSubmitting || items.length === 0}
                className="rounded-lg bg-green-600 px-8 py-3 font-bold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Processando...' : 'Confirmar Pedido'}
              </button>
            </div>
          </form>

          <aside className="h-fit rounded-3xl border border-stone-200 bg-white p-6 shadow-sm lg:sticky lg:top-6">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-600">Resumo</p>
            <h2 className="mt-2 text-2xl font-semibold text-stone-900">Seu carrinho</h2>
            <div className="mt-6 space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 border-b border-stone-100 pb-4">
                  <div>
                    <p className="font-medium text-stone-900">{item.name}</p>
                    <p className="text-sm text-stone-500">{item.quantity}x item</p>
                  </div>
                  <p className="text-sm font-semibold text-stone-900">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-6 space-y-3 text-sm">
              <div className="flex items-center justify-between text-stone-600">
                <span>Itens</span>
                <span>{itemCount}</span>
              </div>
              <div className="flex items-center justify-between text-stone-600">
                <span>Subtotal estimado</span>
                <span>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-stone-200 pt-3 text-base font-semibold text-stone-900">
                <span>Total final</span>
                <span>Confirmado pelo backend</span>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
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

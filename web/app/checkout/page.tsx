'use client';

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
  const { items, clearCart } = useCart();
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
    <div className="max-w-2xl mx-auto p-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Finalizar Pedido</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-lg font-semibold mb-4">Dados Pessoais</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              className="border p-2 rounded"
              placeholder="Nome completo"
              required
              value={formData.name}
              onChange={(event) => setFormData({ ...formData, name: event.target.value })}
            />
            <input
              className="border p-2 rounded"
              placeholder="WhatsApp/Telefone"
              required
              value={formData.phone}
              onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
            />
            <input
              className="border p-2 rounded md:col-span-2"
              placeholder="E-mail para pagamento Pix"
              required={formData.paymentMethod === 'pix'}
              type="email"
              value={formData.email}
              onChange={(event) => setFormData({ ...formData, email: event.target.value })}
            />
          </div>
        </section>

        <section className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-lg font-semibold mb-4">Endereço de Entrega</h2>
          <div className="space-y-4">
            <input
              className="w-full border p-2 rounded"
              placeholder="Rua / Logradouro"
              required
              value={formData.street}
              onChange={(event) => setFormData({ ...formData, street: event.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <input
                className="border p-2 rounded"
                placeholder="Número"
                required
                value={formData.number}
                onChange={(event) => setFormData({ ...formData, number: event.target.value })}
              />
              <input
                className="border p-2 rounded"
                placeholder="Cidade"
                required
                value={formData.city}
                onChange={(event) => setFormData({ ...formData, city: event.target.value })}
              />
            </div>
          </div>
        </section>

        <section className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-lg font-semibold mb-4">Pagamento</h2>
          <select
            className="w-full border p-2 rounded"
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

        <div className="bg-gray-100 p-4 rounded-lg flex justify-between items-center">
          <div>
            <p className="text-gray-600">Total final confirmado após o envio</p>
            <p className="text-sm text-gray-500">
              O backend recalcula subtotal, taxa e descontos antes de criar o pedido.
            </p>
          </div>
          <button
            type="submit"
            disabled={isSubmitting || items.length === 0}
            className="bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Processando...' : 'Confirmar Pedido'}
          </button>
        </div>
      </form>
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

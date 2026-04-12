'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Clock, Copy, MapPin, Package } from 'lucide-react';
import type { CanonicalOrder } from '@/lib/contracts';
import {
  fetchPublicOrder,
  persistLastOrder,
  persistOrderAccessToken,
  readLastOrder,
  readOrderAccessToken,
  PublicOrderApiError,
} from '@/lib/orders/public';

interface OrderTrackingViewProps {
  orderId: string;
}

const statusMap: Record<CanonicalOrder['status'], string> = {
  pending: 'Aguardando confirmação',
  confirmed: 'Pedido confirmado',
  preparing: 'Na cozinha',
  out_for_delivery: 'Saiu para entrega',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

const paymentStatusMap: Record<CanonicalOrder['payment_status'], string> = {
  unpaid: 'Aguardando pagamento',
  pending: 'Pagamento pendente',
  paid: 'Pagamento aprovado',
  failed: 'Pagamento falhou',
  expired: 'Pagamento expirado',
};

export function OrderTrackingView({ orderId }: OrderTrackingViewProps) {
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<CanonicalOrder | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const storedOrder = readLastOrder(orderId);
    const queryAccessToken = searchParams.get('access_token')?.trim() || null;

    if (storedOrder) {
      setOrder({
        order_id: storedOrder.orderId,
        order_number: storedOrder.orderNumber,
        status: storedOrder.status,
        payment_method: storedOrder.paymentMethod,
        payment_status: storedOrder.paymentStatus,
        subtotal: storedOrder.subtotal,
        delivery_fee: storedOrder.deliveryFee,
        discount_amount: storedOrder.discountAmount,
        total_amount: storedOrder.totalAmount,
        estimated_time_minutes: storedOrder.estimatedTimeMinutes,
        fulfillment_type: storedOrder.fulfillmentType,
        items: [],
        payment_data: storedOrder.paymentData,
        customer: { name: '', phone: '' },
        delivery_address: storedOrder.deliveryAddress,
        status_history: storedOrder.statusHistory,
        created_at: storedOrder.createdAt,
        updated_at: storedOrder.updatedAt,
      });
    }

    if (queryAccessToken) {
      setAccessToken(queryAccessToken);
      persistOrderAccessToken(orderId, queryAccessToken);
      return;
    }

    if (storedOrder?.accessToken) {
      setAccessToken(storedOrder.accessToken);
      return;
    }

    const persistedAccessToken = readOrderAccessToken(orderId);
    if (persistedAccessToken) {
      setAccessToken(persistedAccessToken);
    }
  }, [orderId, searchParams]);

  useEffect(() => {
    if (!accessToken) {
      setErrorMessage('Este pedido precisa do link original de acompanhamento para ser aberto com segurança.');
      return;
    }

    let cancelled = false;

    const loadOrder = async () => {
      try {
        const nextOrder = await fetchPublicOrder(orderId, accessToken);

        if (cancelled) {
          return;
        }

        setOrder(nextOrder);
        persistLastOrder(nextOrder, accessToken);
        persistOrderAccessToken(orderId, accessToken);
        setErrorMessage(null);

        if (shouldContinuePolling(nextOrder.status, nextOrder.payment_status)) {
          pollTimeoutRef.current = setTimeout(
            loadOrder,
            getPollingDelayMs(nextOrder.status, nextOrder.payment_status),
          );
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error('Failed to load canonical order', error);

        if (error instanceof PublicOrderApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('Não foi possível atualizar o status do pedido agora.');
        }

        pollTimeoutRef.current = setTimeout(loadOrder, 10000);
      }
    };

    loadOrder();

    return () => {
      cancelled = true;

      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [accessToken, orderId]);

  useEffect(() => {
    if (!copyFeedback) {
      return;
    }

    const timeout = setTimeout(() => setCopyFeedback(null), 2500);
    return () => clearTimeout(timeout);
  }, [copyFeedback]);

  const history = useMemo(() => order?.status_history ?? [], [order?.status_history]);

  const handleCopyPixCode = async () => {
    const pixCode = order?.payment_data?.copy_paste_code;

    if (!pixCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(pixCode);
      setCopyFeedback('Código Pix copiado.');
    } catch (error) {
      console.error('Failed to copy Pix code', error);
      setCopyFeedback('Não foi possível copiar o código Pix.');
    }
  };

  if (!order) {
    return <div className="p-8 text-center">Carregando pedido...</div>;
  }

  return (
    <div className="max-w-xl mx-auto p-4 py-12">
      <div className="text-center mb-8">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold">Pedido Recebido!</h1>
        <p className="text-gray-600">Seu pedido #{order.order_number} já está sendo acompanhado em tempo real.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="font-bold text-lg mb-4">Status do Pedido</h2>
        <div className="flex items-center gap-4 p-4 bg-orange-50 rounded-lg border border-orange-100">
          <Clock className="text-orange-600" />
          <div>
            <p className="font-bold text-orange-800">{statusMap[order.status]}</p>
            <p className="text-sm text-orange-600">Atualizado automaticamente</p>
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {errorMessage}
          </div>
        ) : null}

        {history.length > 0 ? (
          <div className="mt-6 space-y-3">
            {history.map((entry, index) => (
              <div
                key={`${entry.status}-${entry.changed_at}-${index}`}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <div>
                  <p className="font-medium text-gray-900">{statusMap[entry.status]}</p>
                  {entry.note ? <p className="text-gray-500">{entry.note}</p> : null}
                </div>
                <span className="text-gray-500 whitespace-nowrap">{formatDateTime(entry.changed_at)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="font-bold text-lg mb-4">Pagamento</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-gray-700">Forma de pagamento</p>
            <p className="font-semibold uppercase">{order.payment_method}</p>
          </div>
          <div className="flex items-center justify-between gap-4">
            <p className="text-gray-700">Status do pagamento</p>
            <p className="font-semibold">{paymentStatusMap[order.payment_status]}</p>
          </div>

          {order.payment_method === 'pix' && order.payment_data?.copy_paste_code ? (
            <div className="pt-2">
              <p className="text-sm text-gray-600 mb-3">Use o código Pix abaixo para concluir o pagamento.</p>
              {order.payment_data.qr_code_base64 ? (
                <div className="mb-3 flex justify-center rounded-lg border bg-white p-3">
                  <img
                    src={resolveQrImageSrc(order.payment_data.qr_code_base64)}
                    alt="QR Code Pix"
                    className="h-48 w-48"
                  />
                </div>
              ) : null}
              <div className="rounded-lg border bg-gray-50 p-3 break-all text-sm text-gray-700">
                {order.payment_data.copy_paste_code}
              </div>
              <button
                type="button"
                onClick={handleCopyPixCode}
                className="mt-3 inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700"
              >
                <Copy className="w-4 h-4" />
                Copiar código Pix
              </button>
              {copyFeedback ? <p className="text-sm text-gray-600 mt-2">{copyFeedback}</p> : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="font-bold text-lg mb-4">Resumo da Entrega</h2>
        <div className="space-y-4">
          {order.delivery_address ? (
            <div className="flex gap-3">
              <MapPin className="text-gray-400 w-5" />
              <p className="text-gray-700">
                {order.delivery_address.street}, {order.delivery_address.number} - {order.delivery_address.city}
              </p>
            </div>
          ) : null}
          <div className="flex gap-3">
            <Package className="text-gray-400 w-5" />
            <p className="text-gray-700">
              Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getPollingDelayMs(
  status: CanonicalOrder['status'],
  paymentStatus: CanonicalOrder['payment_status'],
) {
  if (paymentStatus === 'pending' || paymentStatus === 'unpaid') {
    return 4000;
  }

  switch (status) {
    case 'pending':
    case 'confirmed':
      return 5000;
    case 'preparing':
      return 7000;
    case 'out_for_delivery':
      return 10000;
    default:
      return 15000;
  }
}

function shouldContinuePolling(
  status: CanonicalOrder['status'],
  paymentStatus: CanonicalOrder['payment_status'],
) {
  if (status === 'cancelled' || status === 'delivered') {
    return false;
  }

  if (paymentStatus === 'failed' || paymentStatus === 'expired') {
    return false;
  }

  return true;
}

function resolveQrImageSrc(qrCodeBase64: string) {
  if (qrCodeBase64.startsWith('data:image')) {
    return qrCodeBase64;
  }

  return `data:image/png;base64,${qrCodeBase64}`;
}

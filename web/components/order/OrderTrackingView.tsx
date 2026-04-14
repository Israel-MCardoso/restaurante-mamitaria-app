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

const paymentMethodMap: Record<CanonicalOrder['payment_method'], string> = {
  pix: 'Pix',
  cash: 'Dinheiro',
  card: 'Cartão',
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
      if (!order) {
        setErrorMessage('Não conseguimos localizar seu pedido. Verifique o link e tente novamente.');
      } else {
        setErrorMessage(null);
      }
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

        if (process.env.NODE_ENV !== 'production') {
          console.error('Failed to load order', error);
        }

        if (error instanceof PublicOrderApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('Não foi possível atualizar o pedido agora. Tente novamente em instantes.');
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
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to copy Pix code', error);
      }
      setCopyFeedback('Não foi possível copiar o código Pix.');
    }
  };

  if (!order) {
    return (
      <main className="page-shell pt-10">
        <section className="section-shell min-h-screen">
          <div className="content-shell">
            <div className="soft-card flex min-h-[360px] items-center justify-center rounded-[2rem] p-8 text-center">
              <div>
                <Clock className="mx-auto h-8 w-8" style={{ color: 'var(--brand)' }} />
                <p
                  className="mt-4 text-sm font-semibold uppercase tracking-[0.2em]"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  Carregando pedido
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell pt-10">
      <section className="section-shell min-h-screen">
        <div className="content-shell">
          <div className="mb-8 text-center">
            <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
            <h1
              className="text-[3.2rem] leading-none tracking-[-0.05em]"
              style={{ color: 'var(--ink-strong)', fontFamily: 'var(--font-display)' }}
            >
              Pedido recebido!
            </h1>
            <p className="mt-4 text-base leading-7" style={{ color: 'var(--ink-muted)' }}>
              Seu pedido #{order.order_number} já foi registrado e você pode acompanhar cada etapa por aqui.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.45fr)] lg:items-start">
            <div className="soft-card rounded-[2rem] p-7 sm:p-9">
              <span className="section-kicker">Acompanhamento</span>
              <h2
                className="mt-4 text-[clamp(3rem,5vw,4.6rem)] leading-[0.94] tracking-[-0.05em]"
                style={{ color: 'var(--ink-strong)', fontFamily: 'var(--font-display)' }}
              >
                {statusMap[order.status]}
              </h2>
              <div
                className="mt-6 flex items-center gap-4 rounded-[1.25rem] border p-4"
                style={{
                  backgroundColor: 'rgba(200, 135, 63, 0.08)',
                  borderColor: 'rgba(200, 135, 63, 0.18)',
                }}
              >
                <Clock style={{ color: 'var(--brand)' }} />
                <div>
                  <p className="font-bold" style={{ color: 'var(--brand)' }}>
                    {statusMap[order.status]}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                    Atualizado automaticamente
                  </p>
                </div>
              </div>

              {errorMessage ? (
                <div
                  className="mt-4 rounded-[1.25rem] border px-4 py-3 text-sm"
                  style={{ borderColor: '#f0d7a6', backgroundColor: '#fff8e7', color: '#946200' }}
                >
                  {errorMessage}
                </div>
              ) : null}

              {history.length > 0 ? (
                <div className="mt-8 space-y-4">
                  {history.map((entry, index) => (
                    <div
                      key={`${entry.status}-${entry.changed_at}-${index}`}
                      className="flex items-start justify-between gap-3 rounded-[1.25rem] border p-4 text-sm"
                      style={{ borderColor: 'var(--line)', backgroundColor: 'rgba(255,250,244,0.52)' }}
                    >
                      <div>
                        <p className="font-medium" style={{ color: 'var(--ink-strong)' }}>
                          {statusMap[entry.status]}
                        </p>
                        {entry.note ? <p style={{ color: 'var(--ink-muted)' }}>{entry.note}</p> : null}
                      </div>
                      <span className="whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>
                        {formatDateTime(entry.changed_at)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <aside className="soft-card rounded-[2rem] p-6">
              <span className="section-kicker">Resumo</span>
              <div className="mt-5 grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <p style={{ color: 'var(--ink-muted)' }}>Forma de pagamento</p>
                  <p className="font-semibold">{paymentMethodMap[order.payment_method]}</p>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <p style={{ color: 'var(--ink-muted)' }}>Status do pagamento</p>
                  <p className="font-semibold">{paymentStatusMap[order.payment_status]}</p>
                </div>

                {order.payment_method === 'pix' && order.payment_data?.copy_paste_code ? (
                  <div className="pt-2">
                    <p className="mb-3 text-sm" style={{ color: 'var(--ink-muted)' }}>
                      Use o código Pix abaixo para concluir o pagamento.
                    </p>
                    {order.payment_data.qr_code_base64 ? (
                      <div
                        className="mb-3 flex justify-center rounded-lg border bg-white p-3"
                        style={{ borderColor: 'var(--line)' }}
                      >
                        <img
                          src={resolveQrImageSrc(order.payment_data.qr_code_base64)}
                          alt="QR Code Pix"
                          className="h-48 w-48"
                        />
                      </div>
                    ) : null}
                    <div
                      className="rounded-lg border p-3 break-all text-sm"
                      style={{
                        borderColor: 'var(--line)',
                        backgroundColor: 'rgba(255,250,244,0.52)',
                        color: 'var(--ink)',
                      }}
                    >
                      {order.payment_data.copy_paste_code}
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyPixCode}
                      className="premium-button mt-3 px-4 py-3 sm:w-auto"
                    >
                      <Copy className="h-4 w-4" />
                      Copiar código Pix
                    </button>
                    {copyFeedback ? (
                      <p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
                        {copyFeedback}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-6 space-y-4 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
                  {order.delivery_address ? (
                    <div className="flex gap-3">
                      <MapPin className="w-5" style={{ color: 'var(--ink-muted)' }} />
                      <p style={{ color: 'var(--ink)' }}>
                        {order.delivery_address.street}, {order.delivery_address.number} - {order.delivery_address.city}
                      </p>
                    </div>
                  ) : null}
                  <div className="flex gap-3">
                    <Package className="w-5" style={{ color: 'var(--ink-muted)' }} />
                    <p style={{ color: 'var(--ink)' }}>
                      Total:{' '}
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        order.total_amount,
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
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

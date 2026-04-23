import type { CanonicalOrder, PaymentData } from '@/lib/contracts';
import { ApiError } from '@/lib/api/errors';
import {
  buildRestaurantMercadoPagoWebhookUrl,
  requireEnabledRestaurantMercadoPagoIntegration,
} from '@/lib/payments/mercado-pago-integration';
import {
  assertMercadoPagoProvider,
  logMercadoPagoEvent,
  redactMercadoPagoText,
} from '@/lib/payments/mercado-pago-security';

interface MercadoPagoPaymentResponse {
  id: number | string;
  status?: string;
  status_detail?: string;
  date_of_expiration?: string | null;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string | null;
      qr_code_base64?: string | null;
      ticket_url?: string | null;
      transaction_id?: string | null;
    };
  };
}

export interface PixPaymentResult {
  paymentData: PaymentData;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'expired';
}

export async function createMercadoPagoPixPayment(
  order: CanonicalOrder,
  payerEmail: string | null,
  restaurantId: string,
): Promise<PixPaymentResult> {
  const integration = await requireEnabledRestaurantMercadoPagoIntegration(restaurantId);
  const accessToken = integration.access_token;

  assertMercadoPagoProvider(integration.provider);

  const normalizedPayerEmail = resolvePixPayerEmail(order, payerEmail);

  const requestBody = {
    transaction_amount: order.total_amount,
    description: `Pedido ${order.order_number}`,
    payment_method_id: 'pix',
    date_of_expiration: buildPixExpirationTimestamp(),
    external_reference: order.order_id,
    notification_url: buildRestaurantMercadoPagoWebhookUrl(restaurantId),
    metadata: {
      restaurant_id: restaurantId,
      order_id: order.order_id,
      order_number: order.order_number,
    },
    payer: {
      email: normalizedPayerEmail,
      first_name: extractFirstName(order.customer.name),
      last_name: extractLastName(order.customer.name),
      address: order.delivery_address
        ? {
            zip_code: order.delivery_address.zip_code ?? undefined,
            street_name: order.delivery_address.street,
            street_number: order.delivery_address.number,
          }
        : undefined,
    },
  };

  const response = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-Idempotency-Key': `pix-${order.order_id}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const bodyText = redactMercadoPagoText(await response.text());
    logMercadoPagoEvent('pix.create_failed', {
      restaurantId,
      orderId: order.order_id,
      orderNumber: order.order_number,
      responseStatus: response.status,
    });
    throw new ApiError(
      502,
      'PIX_PAYMENT_CREATION_FAILED',
      bodyText
        ? 'Não foi possível gerar o Pix com o Mercado Pago agora.'
        : 'Não foi possível gerar o Pix agora. Tente novamente em instantes.',
    );
  }

  const payment = (await response.json()) as MercadoPagoPaymentResponse;
  const transactionData = payment.point_of_interaction?.transaction_data;

  if (!transactionData?.qr_code || !transactionData.qr_code_base64) {
    logMercadoPagoEvent('pix.create_missing_qr', {
      restaurantId,
      orderId: order.order_id,
      orderNumber: order.order_number,
      providerTransactionId: String(payment.id),
    });
    throw new ApiError(
      502,
      'PIX_PAYMENT_DATA_MISSING',
      'Não foi possível gerar o QR Code Pix agora. Tente novamente em instantes.',
    );
  }

  return {
    paymentData: {
      qr_code: transactionData.qr_code,
      qr_code_base64: transactionData.qr_code_base64,
      copy_paste_code: transactionData.qr_code,
      expires_at: payment.date_of_expiration ?? null,
      provider_transaction_id: String(payment.id),
    },
    paymentStatus: mapMercadoPagoStatus(payment.status, payment.status_detail),
  };
}

function buildPixExpirationTimestamp() {
  const expirationMinutes = Number(process.env.PIX_EXPIRATION_MINUTES ?? '60');
  const safeMinutes = Number.isFinite(expirationMinutes) ? Math.min(Math.max(expirationMinutes, 30), 43200) : 60;
  const expirationDate = new Date(Date.now() + safeMinutes * 60 * 1000);
  return expirationDate.toISOString();
}

function resolvePixPayerEmail(order: CanonicalOrder, payerEmail: string | null) {
  const normalizedEmail = payerEmail?.trim().toLowerCase() ?? '';

  if (normalizedEmail) {
    return normalizedEmail;
  }

  const sanitizedPhone = order.customer.phone.replace(/\D/g, '').slice(-8) || 'cliente';
  const orderFragment = order.order_id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toLowerCase() || 'pedido';

  return `pix-${sanitizedPhone}-${orderFragment}@checkout.familiamineira.app`;
}

function extractFirstName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts[0] ?? name;
}

function extractLastName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(1).join(' ') || 'Cliente';
}

function mapMercadoPagoStatus(status?: string, statusDetail?: string): 'pending' | 'paid' | 'failed' | 'expired' {
  if (status === 'approved') {
    return 'paid';
  }

  if (status === 'cancelled' && statusDetail?.toLowerCase().includes('expired')) {
    return 'expired';
  }

  if (status === 'rejected' || status === 'cancelled') {
    return 'failed';
  }

  return 'pending';
}

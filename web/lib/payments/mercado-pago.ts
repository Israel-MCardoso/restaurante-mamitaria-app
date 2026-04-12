import type { CanonicalOrder, PaymentData } from '@/lib/contracts';
import { ApiError } from '@/lib/api/errors';

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
  payerEmail: string,
): Promise<PixPaymentResult> {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

  if (!accessToken) {
    throw new ApiError(500, 'MISSING_MERCADO_PAGO_ACCESS_TOKEN', 'Mercado Pago access token is not configured.');
  }

  const normalizedPayerEmail = payerEmail.trim();

  if (!normalizedPayerEmail) {
    throw new ApiError(400, 'PIX_PAYER_EMAIL_REQUIRED', 'Customer email is required for Pix payments.', 'customer.email');
  }

  const requestBody = {
    transaction_amount: order.total_amount,
    description: `Pedido ${order.order_number}`,
    payment_method_id: 'pix',
    date_of_expiration: buildPixExpirationTimestamp(),
    external_reference: order.order_id,
    notification_url: process.env.MERCADO_PAGO_WEBHOOK_URL,
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
    const bodyText = await response.text();
    throw new ApiError(
      502,
      'PIX_PAYMENT_CREATION_FAILED',
      `Mercado Pago Pix payment creation failed: ${bodyText || response.statusText}`,
    );
  }

  const payment = (await response.json()) as MercadoPagoPaymentResponse;
  const transactionData = payment.point_of_interaction?.transaction_data;

  if (!transactionData?.qr_code || !transactionData.qr_code_base64) {
    throw new ApiError(
      502,
      'PIX_PAYMENT_DATA_MISSING',
      'Mercado Pago did not return QR code data for the Pix payment.',
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

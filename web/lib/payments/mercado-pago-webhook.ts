import { createHmac, timingSafeEqual } from 'crypto';
import { ApiError } from '@/lib/api/errors';

interface MercadoPagoWebhookContext {
  dataId: string;
  requestId: string;
  xSignature: string;
}

export interface MercadoPagoWebhookNotification {
  action?: string;
  data?: {
    id?: string | number;
  };
  type?: string;
}

export interface MercadoPagoPaymentDetails {
  id: number | string;
  status?: string;
  status_detail?: string;
  date_of_expiration?: string | null;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string | null;
      qr_code_base64?: string | null;
      transaction_id?: string | null;
    };
  };
  external_reference?: string | null;
}

export function validateMercadoPagoWebhookSignature(context: MercadoPagoWebhookContext) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;

  if (!secret) {
    throw new ApiError(500, 'MISSING_MERCADO_PAGO_WEBHOOK_SECRET', 'Mercado Pago webhook secret is not configured.');
  }

  const signatureParts = parseSignatureHeader(context.xSignature);
  const ts = signatureParts.ts;
  const v1 = signatureParts.v1;

  if (!ts || !v1) {
    throw new ApiError(401, 'INVALID_WEBHOOK_SIGNATURE', 'Mercado Pago webhook signature is invalid.');
  }

  const manifest = `id:${context.dataId.toLowerCase()};request-id:${context.requestId};ts:${ts};`;
  const expectedSignature = createHmac('sha256', secret).update(manifest).digest('hex');

  const receivedBuffer = Buffer.from(v1, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) {
    throw new ApiError(401, 'INVALID_WEBHOOK_SIGNATURE', 'Mercado Pago webhook signature is invalid.');
  }
}

export async function getMercadoPagoPaymentDetails(paymentId: string): Promise<MercadoPagoPaymentDetails> {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

  if (!accessToken) {
    throw new ApiError(500, 'MISSING_MERCADO_PAGO_ACCESS_TOKEN', 'Mercado Pago access token is not configured.');
  }

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new ApiError(
      502,
      'MERCADO_PAGO_PAYMENT_LOOKUP_FAILED',
      `Mercado Pago payment lookup failed: ${bodyText || response.statusText}`,
    );
  }

  return (await response.json()) as MercadoPagoPaymentDetails;
}

export function mapMercadoPagoWebhookPaymentStatus(
  status?: string,
  statusDetail?: string,
): 'pending' | 'paid' | 'failed' | 'expired' {
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

function parseSignatureHeader(signature: string) {
  return signature
    .split(',')
    .map((entry) => entry.trim())
    .reduce<Record<string, string>>((accumulator, entry) => {
      const [key, value] = entry.split('=');

      if (key && value) {
        accumulator[key.trim()] = value.trim();
      }

      return accumulator;
    }, {});
}

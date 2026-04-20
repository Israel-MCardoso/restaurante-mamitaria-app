import { createHmac, timingSafeEqual } from 'crypto';
import { ApiError } from '@/lib/api/errors';
import {
  getRestaurantMercadoPagoIntegration,
  type MercadoPagoIntegrationRecord,
} from '@/lib/payments/mercado-pago-integration';
import {
  assertMercadoPagoProvider,
  isUuid,
  logMercadoPagoEvent,
  redactMercadoPagoText,
} from '@/lib/payments/mercado-pago-security';

interface MercadoPagoWebhookContext {
  dataId: string;
  requestId: string;
  xSignature: string;
  secret: string;
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
  metadata?: Record<string, unknown> | null;
}

export function validateMercadoPagoWebhookSignature(context: MercadoPagoWebhookContext) {
  const signatureParts = parseSignatureHeader(context.xSignature);
  const ts = signatureParts.ts;
  const v1 = signatureParts.v1;

  if (!ts || !v1) {
    throw new ApiError(401, 'INVALID_WEBHOOK_SIGNATURE', 'Mercado Pago webhook signature is invalid.');
  }

  const manifest = `id:${context.dataId.toLowerCase()};request-id:${context.requestId};ts:${ts};`;
  const expectedSignature = createHmac('sha256', context.secret).update(manifest).digest('hex');

  const receivedBuffer = Buffer.from(v1, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) {
    throw new ApiError(401, 'INVALID_WEBHOOK_SIGNATURE', 'Mercado Pago webhook signature is invalid.');
  }
}

export async function getMercadoPagoPaymentDetails(paymentId: string, accessToken: string): Promise<MercadoPagoPaymentDetails> {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const bodyText = redactMercadoPagoText(await response.text());
    logMercadoPagoEvent('webhook.payment_lookup_failed', {
      paymentId,
      responseStatus: response.status,
    });
    throw new ApiError(
      502,
      'MERCADO_PAGO_PAYMENT_LOOKUP_FAILED',
      bodyText
        ? 'Não foi possível confirmar o pagamento no Mercado Pago.'
        : 'Não foi possível confirmar o pagamento no Mercado Pago.',
    );
  }

  return (await response.json()) as MercadoPagoPaymentDetails;
}

export async function resolveMercadoPagoWebhookIntegration(restaurantId: string): Promise<MercadoPagoIntegrationRecord> {
  if (!isUuid(restaurantId)) {
    throw new ApiError(400, 'INVALID_RESTAURANT_ID', 'Webhook recebido sem restaurant_id válido.');
  }

  const integration = await getRestaurantMercadoPagoIntegration(restaurantId);

  if (!integration?.is_enabled || !integration.access_token?.trim()) {
    throw new ApiError(404, 'MERCADO_PAGO_INTEGRATION_NOT_FOUND', 'No active Mercado Pago integration found for this restaurant.');
  }

  assertMercadoPagoProvider(integration.provider);

  return integration;
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

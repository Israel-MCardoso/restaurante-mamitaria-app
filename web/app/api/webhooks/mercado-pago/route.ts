import { NextResponse } from 'next/server';
import { ApiError, ensureApiError, errorResponseBody, parseJsonBody } from '@/lib/api/errors';
import {
  getMercadoPagoPaymentDetails,
  mapMercadoPagoWebhookPaymentStatus,
  resolveMercadoPagoWebhookIntegration,
  type MercadoPagoWebhookNotification,
  validateMercadoPagoWebhookSignature,
} from '@/lib/payments/mercado-pago-webhook';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { isUuid, logMercadoPagoEvent } from '@/lib/payments/mercado-pago-security';

export async function POST(request: Request) {
  let restaurantId: string | null = null;
  let paymentId: string | null = null;

  try {
    const url = new URL(request.url);
    paymentId = url.searchParams.get('data.id') ?? '';
    restaurantId = url.searchParams.get('restaurant_id') ?? '';
    const xSignature = request.headers.get('x-signature') ?? '';
    const xRequestId = request.headers.get('x-request-id') ?? '';

    if (!paymentId || !restaurantId || !xRequestId) {
      throw new ApiError(400, 'INVALID_WEBHOOK_REQUEST', 'Mercado Pago webhook request is missing required metadata.');
    }

    if (!isUuid(restaurantId)) {
      throw new ApiError(400, 'INVALID_RESTAURANT_ID', 'Webhook recebido sem restaurant_id válido.');
    }

    const integration = await resolveMercadoPagoWebhookIntegration(restaurantId);

    if (integration.webhook_secret?.trim() && !xSignature) {
      throw new ApiError(401, 'INVALID_WEBHOOK_SIGNATURE', 'Mercado Pago webhook signature is missing.');
    }

    if (integration.webhook_secret?.trim() && xSignature) {
      validateMercadoPagoWebhookSignature({
        dataId: paymentId,
        requestId: xRequestId,
        xSignature,
        secret: integration.webhook_secret,
      });
    }

    const payload = await parseJsonBody<MercadoPagoWebhookNotification>(request);

    if (payload.type !== 'payment' && !String(payload.action ?? '').startsWith('payment.')) {
      return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
    }

    const paymentDetails = await getMercadoPagoPaymentDetails(paymentId, integration.access_token);
    const providerTransactionId = String(paymentDetails.id);
    const paymentStatus = mapMercadoPagoWebhookPaymentStatus(paymentDetails.status, paymentDetails.status_detail);
    const metadataRestaurantId =
      typeof paymentDetails.metadata?.restaurant_id === 'string' ? paymentDetails.metadata.restaurant_id : null;

    if (metadataRestaurantId && metadataRestaurantId !== restaurantId) {
      throw new ApiError(409, 'WEBHOOK_RESTAURANT_MISMATCH', 'Webhook do Mercado Pago recebido para restaurante incorreto.');
    }

    const supabase = getSupabaseAdminClient();
    const { data: orderId, error: lookupError } = await supabase.rpc('find_order_id_by_provider_transaction_id', {
      provider_transaction_id_input: providerTransactionId,
    } as never);

    if (lookupError) {
      throw new ApiError(500, 'ORDER_PAYMENT_LOOKUP_FAILED', 'Unable to find order for payment notification.');
    }

    let resolvedOrderId = orderId as string | null;

    if (!resolvedOrderId && paymentDetails.external_reference) {
      const { data: orderLookup, error: orderLookupError } = await supabase
        .from('orders')
        .select('id')
        .eq('id', paymentDetails.external_reference)
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (orderLookupError) {
        throw new ApiError(500, 'ORDER_PAYMENT_LOOKUP_FAILED', 'Unable to find order for payment notification.');
      }

      const fallbackOrder = orderLookup as { id?: string | null } | null;
      resolvedOrderId = fallbackOrder?.id ?? null;
    }

    if (!resolvedOrderId) {
      throw new ApiError(404, 'ORDER_NOT_FOUND_FOR_PAYMENT', 'No order found for Mercado Pago payment notification.');
    }

    const { data: orderRow, error: orderRowError } = await supabase
      .from('orders')
      .select('id, restaurant_id, payment_status, payment_data')
      .eq('id', resolvedOrderId)
      .maybeSingle();

    if (orderRowError || !orderRow) {
      throw new ApiError(404, 'ORDER_NOT_FOUND_FOR_PAYMENT', 'No order found for Mercado Pago payment notification.');
    }

    const orderRecord = orderRow as {
      id: string;
      restaurant_id: string;
      payment_status?: string | null;
      payment_data?: { provider_transaction_id?: string | null } | null;
    };

    if (orderRecord.restaurant_id !== restaurantId) {
      throw new ApiError(403, 'ORDER_RESTAURANT_MISMATCH', 'Webhook attempted to update an order from another restaurant.');
    }

    const currentProviderTransactionId = orderRecord.payment_data?.provider_transaction_id ?? null;

    if (currentProviderTransactionId && currentProviderTransactionId !== providerTransactionId) {
      throw new ApiError(409, 'PROVIDER_TRANSACTION_ID_MISMATCH', 'Webhook payment transaction does not match the stored order transaction.');
    }

    if (paymentDetails.external_reference && paymentDetails.external_reference !== resolvedOrderId) {
      throw new ApiError(409, 'WEBHOOK_EXTERNAL_REFERENCE_MISMATCH', 'Webhook payment reference does not match the target order.');
    }

    const paymentData = {
      qr_code: paymentDetails.point_of_interaction?.transaction_data?.qr_code ?? null,
      qr_code_base64: paymentDetails.point_of_interaction?.transaction_data?.qr_code_base64 ?? null,
      copy_paste_code: paymentDetails.point_of_interaction?.transaction_data?.qr_code ?? null,
      expires_at: paymentDetails.date_of_expiration ?? null,
      provider_transaction_id: providerTransactionId,
    };

    const currentPaymentStatus = (orderRecord.payment_status ?? '').toLowerCase();

    if (
      currentProviderTransactionId === providerTransactionId &&
      currentPaymentStatus === paymentStatus
    ) {
      return NextResponse.json({ ok: true, replay: true }, { status: 200 });
    }

    const { data: updateResponse, error: updateError } = await supabase.rpc('update_order_payment_data', {
      order_id_input: resolvedOrderId,
      payment_status_input: paymentStatus,
      payment_data_input: paymentData,
    } as never);

    if (updateError) {
      throw new ApiError(500, 'ORDER_PAYMENT_UPDATE_FAILED', 'Unable to update order payment status from webhook.');
    }

    const updatedOrder = (updateResponse as { order?: unknown } | null)?.order;

    if (updatedOrder) {
      const { error: syncError } = await (supabase as any)
        .from('order_idempotency_keys')
        .update({
          response_body: {
            order: updatedOrder,
          },
        })
        .eq('order_id', resolvedOrderId);

      if (syncError) {
        throw new ApiError(500, 'IDEMPOTENCY_RESPONSE_SYNC_FAILED', 'Unable to sync order response after webhook.');
      }
    }

    logMercadoPagoEvent('webhook.updated', {
      restaurantId,
      paymentId,
      orderId: resolvedOrderId,
      paymentStatus,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const apiError = ensureApiError(error, {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unexpected server error while processing Mercado Pago webhook.',
    });

    logMercadoPagoEvent(
      'webhook.failed',
      {
        restaurantId,
        paymentId,
        code: apiError.code,
      },
      error,
    );

    return NextResponse.json(errorResponseBody(apiError), {
      status: apiError.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  }
}

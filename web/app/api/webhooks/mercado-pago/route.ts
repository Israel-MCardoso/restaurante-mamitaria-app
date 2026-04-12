import { NextResponse } from 'next/server';
import { ApiError, ensureApiError, errorResponseBody, parseJsonBody } from '@/lib/api/errors';
import {
  getMercadoPagoPaymentDetails,
  mapMercadoPagoWebhookPaymentStatus,
  type MercadoPagoWebhookNotification,
  validateMercadoPagoWebhookSignature,
} from '@/lib/payments/mercado-pago-webhook';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const dataId = url.searchParams.get('data.id') ?? '';
    const xSignature = request.headers.get('x-signature') ?? '';
    const xRequestId = request.headers.get('x-request-id') ?? '';

    if (!dataId || !xSignature || !xRequestId) {
      throw new ApiError(400, 'INVALID_WEBHOOK_REQUEST', 'Mercado Pago webhook request is missing required metadata.');
    }

    validateMercadoPagoWebhookSignature({
      dataId,
      requestId: xRequestId,
      xSignature,
    });

    const payload = await parseJsonBody<MercadoPagoWebhookNotification>(request);

    if (payload.type !== 'payment' && !String(payload.action ?? '').startsWith('payment.')) {
      return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
    }

    const paymentDetails = await getMercadoPagoPaymentDetails(dataId);
    const providerTransactionId = String(paymentDetails.id);
    const paymentStatus = mapMercadoPagoWebhookPaymentStatus(paymentDetails.status, paymentDetails.status_detail);

    const supabase = getSupabaseAdminClient();
    const { data: orderId, error: lookupError } = await supabase.rpc('find_order_id_by_provider_transaction_id', {
      provider_transaction_id_input: providerTransactionId,
    } as never);

    if (lookupError) {
      throw new ApiError(500, 'ORDER_PAYMENT_LOOKUP_FAILED', 'Unable to find order for payment notification.');
    }

    if (!orderId) {
      throw new ApiError(404, 'ORDER_NOT_FOUND_FOR_PAYMENT', 'No order found for Mercado Pago payment notification.');
    }

    const paymentData = {
      qr_code: paymentDetails.point_of_interaction?.transaction_data?.qr_code ?? null,
      qr_code_base64: paymentDetails.point_of_interaction?.transaction_data?.qr_code_base64 ?? null,
      copy_paste_code: paymentDetails.point_of_interaction?.transaction_data?.qr_code ?? null,
      expires_at: paymentDetails.date_of_expiration ?? null,
      provider_transaction_id: providerTransactionId,
    };

    const { data: updateResponse, error: updateError } = await supabase.rpc('update_order_payment_data', {
      order_id_input: orderId,
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
        .eq('order_id', orderId);

      if (syncError) {
        throw new ApiError(500, 'IDEMPOTENCY_RESPONSE_SYNC_FAILED', 'Unable to sync order response after webhook.');
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const apiError = ensureApiError(error, {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unexpected server error while processing Mercado Pago webhook.',
    });

    return NextResponse.json(errorResponseBody(apiError), {
      status: apiError.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  }
}

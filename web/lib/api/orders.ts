import type {
  CanonicalOrder,
  PaymentData,
} from '@/lib/contracts';
import { createHash } from 'crypto';
import {
  validateCanonicalOrder,
  validateCreateOrderRequest,
} from '@/lib/contracts';
import { ApiError } from '@/lib/api/errors';
import { createMercadoPagoPixPayment } from '@/lib/payments/mercado-pago';
import {
  getMercadoPagoPaymentDetails,
  mapMercadoPagoWebhookPaymentStatus,
} from '@/lib/payments/mercado-pago-webhook';
import { getRestaurantMercadoPagoIntegration } from '@/lib/payments/mercado-pago-integration';
import { logMercadoPagoEvent } from '@/lib/payments/mercado-pago-security';
import { calculateOrderQuote } from '@/lib/checkout/pricing';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

interface CreateOrderRpcResponse {
  order: CanonicalOrder;
  idempotent_replay?: boolean;
  access_token?: string;
}

interface GetOrderRpcResponse {
  order: CanonicalOrder;
}

interface UpdateOrderPaymentRpcResponse {
  order: CanonicalOrder;
}

export interface CreateOrderResult {
  order: CanonicalOrder;
  idempotentReplay: boolean;
  accessToken: string;
}

export async function createOrder(payload: unknown, idempotencyKey: string): Promise<CreateOrderResult> {
  const validationIssues = validateCreateOrderRequest(payload);

  if (validationIssues.length > 0) {
    const firstIssue = validationIssues[0];
    throw new ApiError(400, 'INVALID_REQUEST', firstIssue.message, firstIssue.field);
  }

  if (!idempotencyKey || idempotencyKey.trim().length === 0) {
    throw new ApiError(400, 'MISSING_IDEMPOTENCY_KEY', 'Não foi possível concluir a solicitação agora. Tente novamente.');
  }

  const supabase = getSupabaseAdminClient();
  const normalizedIdempotencyKey = idempotencyKey.trim();
  const requestHash = hashRequestPayload(payload);
  const orderQuote = await calculateOrderQuote(payload as any, { strictCoupon: true });
  const securePayload = {
    ...(payload as Record<string, unknown>),
    delivery_fee_override: orderQuote.deliveryFee,
    discount_amount_override: orderQuote.discountAmount,
  };

  const { data, error } = await supabase.rpc('create_canonical_order', {
    payload: securePayload,
    request_idempotency_key: normalizedIdempotencyKey,
    request_hash: requestHash,
  } as never);

  if (error) {
    throw mapSupabaseError(error.message);
  }

  const response = data as CreateOrderRpcResponse | null;
  const order = response?.order;
  const accessToken = response?.access_token;

  if (!order) {
    throw new ApiError(500, 'ORDER_CREATION_FAILED', 'Não foi possível concluir seu pedido agora. Tente novamente em instantes.');
  }

  if (!accessToken || accessToken.trim().length === 0) {
    throw new ApiError(500, 'INVALID_ORDER_RESPONSE', 'Não foi possível concluir seu pedido agora. Tente novamente em instantes.');
  }

  const orderIssues = validateCanonicalOrder(order);

  if (orderIssues.length > 0) {
    const firstIssue = orderIssues[0];
    throw new ApiError(
      500,
      'INVALID_ORDER_RESPONSE',
      'Não foi possível concluir seu pedido agora. Tente novamente em instantes.',
      firstIssue.field,
    );
  }

  const hydratedOrder = await maybeAttachPixPayment(order, payload);

  return {
    order: hydratedOrder,
    idempotentReplay: response?.idempotent_replay === true,
    accessToken,
  };
}

export async function getOrderById(orderId: string, accessToken: string): Promise<CanonicalOrder> {
  if (!orderId || orderId.trim().length === 0) {
    throw new ApiError(400, 'INVALID_ORDER_ID', 'Não foi possível localizar o pedido.', 'order_id');
  }

  if (!accessToken || accessToken.trim().length === 0) {
    throw new ApiError(401, 'MISSING_ORDER_ACCESS_TOKEN', 'Não conseguimos localizar seu pedido. Verifique o link e tente novamente.');
  }

  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase.rpc('get_canonical_order', {
    order_id_input: orderId.trim(),
    request_access_token: accessToken.trim(),
  } as never);

  if (error) {
    throw mapSupabaseError(error.message);
  }

  const response = data as GetOrderRpcResponse | null;
  const order = response?.order;

  if (!order) {
    throw new ApiError(404, 'ORDER_NOT_FOUND', 'Não encontramos esse pedido.');
  }

  const orderIssues = validateCanonicalOrder(order);

  if (orderIssues.length > 0) {
    const firstIssue = orderIssues[0];
    throw new ApiError(
      500,
      'INVALID_ORDER_RESPONSE',
      'Não foi possível carregar o pedido agora. Tente novamente em instantes.',
      firstIssue.field,
    );
  }

  return reconcilePixPaymentStatus(order);
}

async function maybeAttachPixPayment(order: CanonicalOrder, payload: unknown): Promise<CanonicalOrder> {
  if (order.payment_method !== 'pix') {
    return order;
  }

  const hasExistingPaymentData =
    order.payment_data?.provider_transaction_id &&
    order.payment_data.qr_code &&
    order.payment_data.qr_code_base64;

  if (hasExistingPaymentData) {
    return order;
  }

  const payerEmail = extractPixPayerEmail(payload);
  const restaurantId = await resolveOrderRestaurantId(order.order_id, payload);
  const pixPayment = await createMercadoPagoPixPayment(order, payerEmail, restaurantId);
  const updatedOrder = await updateOrderPaymentData(order.order_id, pixPayment.paymentStatus, pixPayment.paymentData);
  await syncIdempotentOrderResponse(order.order_id, updatedOrder);
  return updatedOrder;
}

async function updateOrderPaymentData(
  orderId: string,
  paymentStatus: 'pending' | 'paid' | 'failed' | 'expired',
  paymentData: PaymentData,
): Promise<CanonicalOrder> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc('update_order_payment_data', {
    order_id_input: orderId,
    payment_status_input: paymentStatus,
    payment_data_input: paymentData,
  } as never);

  if (error) {
    throw mapSupabaseError(error.message);
  }

  const response = data as UpdateOrderPaymentRpcResponse | null;
  const order = response?.order;

  if (!order) {
    throw new ApiError(500, 'PAYMENT_UPDATE_FAILED', 'Order payment update returned an empty response.');
  }

  const orderIssues = validateCanonicalOrder(order);

  if (orderIssues.length > 0) {
    const firstIssue = orderIssues[0];
    throw new ApiError(
      500,
      'INVALID_ORDER_RESPONSE',
      'Não foi possível atualizar as informações de pagamento agora. Tente novamente em instantes.',
      firstIssue.field,
    );
  }

  return order;
}

async function syncIdempotentOrderResponse(orderId: string, order: CanonicalOrder) {
  const supabase = getSupabaseAdminClient();
  const { error } = await (supabase as any)
    .from('order_idempotency_keys')
    .update({
      response_body: {
        order,
      },
    })
    .eq('order_id', orderId);

  if (error) {
    throw new ApiError(500, 'IDEMPOTENCY_RESPONSE_SYNC_FAILED', 'Unable to sync idempotent order response.');
  }
}

async function reconcilePixPaymentStatus(order: CanonicalOrder): Promise<CanonicalOrder> {
  if (order.payment_method !== 'pix') {
    return order;
  }

  if (order.payment_status !== 'pending' && order.payment_status !== 'unpaid') {
    return order;
  }

  const providerTransactionId = order.payment_data?.provider_transaction_id?.trim();

  if (!providerTransactionId) {
    return order;
  }

  const supabase = getSupabaseAdminClient();
  const { data: orderRow, error: orderError } = await (supabase as any)
    .from('orders')
    .select('restaurant_id')
    .eq('id', order.order_id)
    .maybeSingle();

  if (orderError || !orderRow?.restaurant_id) {
    logMercadoPagoEvent(
      'pix.reconcile_order_lookup_failed',
      {
        orderId: order.order_id,
        providerTransactionId,
      },
      orderError ?? new Error('restaurant_id missing'),
    );
    return order;
  }

  const restaurantId = String(orderRow.restaurant_id);
  const integration = await getRestaurantMercadoPagoIntegration(restaurantId).catch((error) => {
    logMercadoPagoEvent(
      'pix.reconcile_integration_lookup_failed',
      {
        orderId: order.order_id,
        restaurantId,
      },
      error,
    );
    return null;
  });

  if (!integration?.is_enabled || !integration.access_token?.trim()) {
    return order;
  }

  const paymentDetails = await getMercadoPagoPaymentDetails(providerTransactionId, integration.access_token).catch((error) => {
    logMercadoPagoEvent(
      'pix.reconcile_lookup_failed',
      {
        orderId: order.order_id,
        restaurantId,
        providerTransactionId,
      },
      error,
    );
    return null;
  });

  if (!paymentDetails) {
    return order;
  }

  const reconciledPaymentStatus = mapMercadoPagoWebhookPaymentStatus(
    paymentDetails.status,
    paymentDetails.status_detail,
  );

  if (reconciledPaymentStatus === order.payment_status) {
    return order;
  }

  const reconciledPaymentData: PaymentData = {
    qr_code: paymentDetails.point_of_interaction?.transaction_data?.qr_code ?? order.payment_data?.qr_code ?? null,
    qr_code_base64:
      paymentDetails.point_of_interaction?.transaction_data?.qr_code_base64 ??
      order.payment_data?.qr_code_base64 ??
      null,
    copy_paste_code:
      paymentDetails.point_of_interaction?.transaction_data?.qr_code ??
      order.payment_data?.copy_paste_code ??
      null,
    expires_at: paymentDetails.date_of_expiration ?? order.payment_data?.expires_at ?? null,
    provider_transaction_id: String(paymentDetails.id ?? providerTransactionId),
  };

  const updatedOrder = await updateOrderPaymentData(
    order.order_id,
    reconciledPaymentStatus,
    reconciledPaymentData,
  );
  await syncIdempotentOrderResponse(order.order_id, updatedOrder);

  logMercadoPagoEvent('pix.reconcile_updated', {
    orderId: order.order_id,
    restaurantId,
    providerTransactionId,
    paymentStatus: reconciledPaymentStatus,
  });

  return updatedOrder;
}

function extractPixPayerEmail(payload: unknown) {
  const customer = (payload as { customer?: { email?: string | null } })?.customer;
  const email = customer?.email?.trim();

  if (!email) {
    throw new ApiError(400, 'PIX_PAYER_EMAIL_REQUIRED', 'Informe um e-mail válido para receber o pagamento via Pix.', 'customer.email');
  }

  return email;
}

async function resolveOrderRestaurantId(orderId: string, payload: unknown) {
  const value = (payload as { restaurant_id?: string | null })?.restaurant_id?.trim();

  if (value) {
    return value;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await (supabase as any)
    .from('orders')
    .select('restaurant_id')
    .eq('id', orderId)
    .maybeSingle();

  if (error || !data?.restaurant_id) {
    logMercadoPagoEvent(
      'pix.resolve_restaurant_failed',
      {
        orderId,
        hasRestaurantIdInPayload: Boolean(value),
      },
      error ?? new Error('restaurant_id missing'),
    );
    throw new ApiError(400, 'RESTAURANT_NOT_FOUND', 'Não foi possível identificar o restaurante para o pagamento Pix.', 'restaurant_id');
  }

  return String(data.restaurant_id);
}

function mapSupabaseError(message: string) {
  const knownMappings: Array<{ pattern: string; status: number; code: string; field?: string }> = [
    { pattern: 'ORDER_NOT_FOUND', status: 404, code: 'ORDER_NOT_FOUND', field: 'order_id' },
    { pattern: 'ORDER_ACCESS_DENIED', status: 403, code: 'ORDER_ACCESS_DENIED' },
    { pattern: 'INVALID_ORDER_STATUS', status: 409, code: 'INVALID_ORDER_STATUS', field: 'status' },
    { pattern: 'INVALID_PAYMENT_STATUS', status: 500, code: 'INVALID_PAYMENT_STATUS' },
    { pattern: 'RESTAURANT_NOT_FOUND', status: 404, code: 'RESTAURANT_NOT_FOUND', field: 'restaurant_id' },
    { pattern: 'RESTAURANT_INACTIVE', status: 409, code: 'RESTAURANT_INACTIVE' },
    { pattern: 'MINIMUM_ORDER_NOT_REACHED', status: 409, code: 'MINIMUM_ORDER_NOT_REACHED' },
    { pattern: 'PRODUCT_NOT_FOUND', status: 404, code: 'PRODUCT_NOT_FOUND', field: 'items' },
    { pattern: 'PRODUCT_UNAVAILABLE', status: 409, code: 'PRODUCT_UNAVAILABLE', field: 'items' },
    { pattern: 'ADDON_NOT_FOUND', status: 404, code: 'ADDON_NOT_FOUND', field: 'items' },
    { pattern: 'ADDON_UNAVAILABLE', status: 409, code: 'ADDON_UNAVAILABLE', field: 'items' },
    { pattern: 'ADDON_NOT_ALLOWED', status: 409, code: 'ADDON_NOT_ALLOWED', field: 'items' },
    { pattern: 'DELIVERY_ADDRESS_REQUIRED', status: 400, code: 'DELIVERY_ADDRESS_REQUIRED', field: 'delivery_address' },
    { pattern: 'INVALID_ITEMS', status: 400, code: 'INVALID_ITEMS', field: 'items' },
    { pattern: 'INVALID_ITEM_QUANTITY', status: 400, code: 'INVALID_ITEM_QUANTITY', field: 'items' },
    { pattern: 'INVALID_ADDON_QUANTITY', status: 400, code: 'INVALID_ADDON_QUANTITY', field: 'items' },
    {
      pattern: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD',
      status: 409,
      code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD',
    },
    { pattern: 'MISSING_IDEMPOTENCY_KEY', status: 400, code: 'MISSING_IDEMPOTENCY_KEY' },
    { pattern: 'MISSING_ORDER_ACCESS_TOKEN', status: 401, code: 'MISSING_ORDER_ACCESS_TOKEN' },
    { pattern: 'PIX_PAYMENT_CREATION_FAILED', status: 502, code: 'PIX_PAYMENT_CREATION_FAILED' },
    { pattern: 'PIX_PAYMENT_DATA_MISSING', status: 502, code: 'PIX_PAYMENT_DATA_MISSING' },
    { pattern: 'PIX_PAYER_EMAIL_REQUIRED', status: 400, code: 'PIX_PAYER_EMAIL_REQUIRED', field: 'customer.email' },
    { pattern: 'MISSING_MERCADO_PAGO_ACCESS_TOKEN', status: 500, code: 'MISSING_MERCADO_PAGO_ACCESS_TOKEN' },
    { pattern: 'MERCADO_PAGO_NOT_CONFIGURED', status: 409, code: 'MERCADO_PAGO_NOT_CONFIGURED' },
    { pattern: 'MERCADO_PAGO_ACCESS_TOKEN_MISSING', status: 409, code: 'MERCADO_PAGO_ACCESS_TOKEN_MISSING' },
    { pattern: 'COUPON_NOT_FOUND', status: 404, code: 'COUPON_NOT_FOUND', field: 'coupon_code' },
    { pattern: 'COUPON_INACTIVE', status: 409, code: 'COUPON_INACTIVE', field: 'coupon_code' },
    { pattern: 'COUPON_EXPIRED', status: 409, code: 'COUPON_EXPIRED', field: 'coupon_code' },
    { pattern: 'COUPON_LIMIT_REACHED', status: 409, code: 'COUPON_LIMIT_REACHED', field: 'coupon_code' },
    { pattern: 'COUPON_MIN_ORDER_NOT_REACHED', status: 409, code: 'COUPON_MIN_ORDER_NOT_REACHED', field: 'coupon_code' },
    { pattern: 'INVALID_PAYMENT_PROVIDER', status: 400, code: 'INVALID_PAYMENT_PROVIDER' },
    { pattern: 'IDEMPOTENCY_RESPONSE_SYNC_FAILED', status: 500, code: 'IDEMPOTENCY_RESPONSE_SYNC_FAILED' },
  ];

  const knownError = knownMappings.find((mapping) => message.includes(mapping.pattern));

  if (knownError) {
    return new ApiError(knownError.status, knownError.code, humanizeErrorCode(knownError.code), knownError.field);
  }

  return new ApiError(
    500,
    'ORDER_CREATION_FAILED',
    'Unable to create order safely at this time.',
    undefined,
    { supabaseMessage: message },
  );
}

function humanizeErrorCode(code: string) {
  switch (code) {
    case 'RESTAURANT_NOT_FOUND':
      return 'Restaurant not found.';
    case 'ORDER_NOT_FOUND':
      return 'Pedido não encontrado.';
    case 'ORDER_ACCESS_DENIED':
      return 'Não conseguimos localizar seu pedido. Verifique o link e tente novamente.';
    case 'INVALID_ORDER_STATUS':
      return 'The requested order status transition is invalid.';
    case 'INVALID_PAYMENT_STATUS':
      return 'Backend tried to persist an invalid payment status.';
    case 'RESTAURANT_INACTIVE':
      return 'Restaurant is not accepting orders right now.';
    case 'MINIMUM_ORDER_NOT_REACHED':
      return 'Seu pedido ainda não atingiu o valor mínimo da loja.';
    case 'PRODUCT_NOT_FOUND':
      return 'One or more selected products no longer exist.';
    case 'PRODUCT_UNAVAILABLE':
      return 'One or more selected products are unavailable.';
    case 'ADDON_NOT_FOUND':
      return 'One or more selected addons no longer exist.';
    case 'ADDON_UNAVAILABLE':
      return 'One or more selected addons are unavailable.';
    case 'ADDON_NOT_ALLOWED':
      return 'One or more selected addons are not allowed for the chosen product.';
    case 'DELIVERY_ADDRESS_REQUIRED':
      return 'Delivery address is required for delivery orders.';
    case 'INVALID_ITEMS':
      return 'Order must include at least one valid item.';
    case 'INVALID_ITEM_QUANTITY':
      return 'One or more items have an invalid quantity.';
    case 'INVALID_ADDON_QUANTITY':
      return 'One or more addons have an invalid quantity.';
    case 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD':
      return 'Seu pedido mudou durante a confirmação. Revise os itens e tente novamente.';
    case 'MISSING_IDEMPOTENCY_KEY':
      return 'Não foi possível concluir a solicitação agora. Tente novamente.';
    case 'MISSING_ORDER_ACCESS_TOKEN':
      return 'Não conseguimos localizar seu pedido. Verifique o link e tente novamente.';
    case 'PIX_PAYMENT_CREATION_FAILED':
      return 'Não foi possível gerar o Pix agora. Tente novamente em instantes.';
    case 'PIX_PAYMENT_DATA_MISSING':
      return 'Não foi possível gerar o Pix agora. Tente novamente em instantes.';
    case 'PIX_PAYER_EMAIL_REQUIRED':
      return 'Informe um e-mail válido para receber o pagamento via Pix.';
    case 'MISSING_MERCADO_PAGO_ACCESS_TOKEN':
      return 'O Pix está temporariamente indisponível.';
    case 'MERCADO_PAGO_NOT_CONFIGURED':
      return 'Este restaurante ainda não configurou o Pix.';
    case 'MERCADO_PAGO_ACCESS_TOKEN_MISSING':
      return 'Este restaurante ainda não concluiu a integração do Pix.';
    case 'COUPON_NOT_FOUND':
      return 'Cupom nao encontrado.';
    case 'COUPON_INACTIVE':
      return 'Este cupom nao esta ativo.';
    case 'COUPON_EXPIRED':
      return 'Este cupom expirou.';
    case 'COUPON_LIMIT_REACHED':
      return 'Este cupom atingiu o limite de uso.';
    case 'COUPON_MIN_ORDER_NOT_REACHED':
      return 'Seu pedido ainda nao atingiu o valor minimo para este cupom.';
    case 'INVALID_PAYMENT_PROVIDER':
      return 'O provedor de pagamento informado não é suportado.';
    case 'IDEMPOTENCY_RESPONSE_SYNC_FAILED':
      return 'Não foi possível concluir seu pedido agora. Tente novamente em instantes.';
    default:
      return 'Não foi possível processar seu pedido agora. Tente novamente em instantes.';
  }
}

function hashRequestPayload(payload: unknown) {
  const stablePayload = stableStringify(payload);
  return createHash('sha256').update(stablePayload).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`);

  return `{${entries.join(',')}}`;
}

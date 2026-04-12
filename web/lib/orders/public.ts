'use client';

import type {
  CanonicalOrder,
  CreateOrderRequest,
  ErrorResponseBody,
} from '@/lib/contracts';

const STORAGE_TTL_MS = 24 * 60 * 60 * 1000;
const LAST_ORDER_SUMMARY_KEY = 'restaurante:last-order-summary';
const LAST_ORDER_SUMMARY_SESSION_KEY = 'restaurante:last-order-summary:session';
const LAST_ORDER_ID_KEY = 'restaurante:last-order-id';
const LAST_ORDER_ID_SESSION_KEY = 'restaurante:last-order-id:session';
const LAST_ORDER_ACCESS_TOKEN_KEY = 'restaurante:last-order-access-token';
const LAST_ORDER_ACCESS_TOKEN_SESSION_KEY = 'restaurante:last-order-access-token:session';
const PENDING_ORDER_ATTEMPT_KEY = 'restaurante:pending-order-attempt';
const PENDING_ORDER_ATTEMPT_SESSION_KEY = 'restaurante:pending-order-attempt:session';

export interface StoredOrderSummary {
  orderId: string;
  orderNumber: string;
  accessToken: string;
  subtotal: CanonicalOrder['subtotal'];
  deliveryFee: CanonicalOrder['delivery_fee'];
  discountAmount: CanonicalOrder['discount_amount'];
  paymentMethod: CanonicalOrder['payment_method'];
  paymentStatus: CanonicalOrder['payment_status'];
  paymentData: CanonicalOrder['payment_data'];
  totalAmount: CanonicalOrder['total_amount'];
  status: CanonicalOrder['status'];
  statusHistory: CanonicalOrder['status_history'];
  estimatedTimeMinutes: CanonicalOrder['estimated_time_minutes'];
  fulfillmentType: CanonicalOrder['fulfillment_type'];
  deliveryAddress: CanonicalOrder['delivery_address'];
  createdAt: CanonicalOrder['created_at'];
  updatedAt: CanonicalOrder['updated_at'];
  storedAt: number;
}

export interface CreateOrderSuccess {
  order: CanonicalOrder;
  accessToken: string;
  idempotencyKey: string;
}

interface PendingOrderAttempt {
  idempotencyKey: string;
  fingerprint: string;
  createdAt: number;
}

export class PublicOrderApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly field?: string;

  constructor(status: number, code: string, message: string, field?: string) {
    super(message);
    this.name = 'PublicOrderApiError';
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

export function createIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `order-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function createPublicOrder(
  payload: CreateOrderRequest,
  idempotencyKey: string,
): Promise<CreateOrderSuccess> {
  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });

  const body = await parseJsonResponse(response);

  if (!response.ok) {
    throw toPublicApiError(response.status, body);
  }

  const accessToken = response.headers.get('Order-Access-Token')?.trim();

  if (!accessToken) {
    throw new PublicOrderApiError(
      500,
      'MISSING_ORDER_ACCESS_TOKEN',
      'Order access token was not returned by the backend.',
    );
  }

  return {
    order: body as CanonicalOrder,
    accessToken,
    idempotencyKey,
  };
}

export async function fetchPublicOrder(orderId: string, accessToken: string): Promise<CanonicalOrder> {
  const response = await fetch(`/api/orders/${orderId}`, {
    method: 'GET',
    headers: {
      'Order-Access-Token': accessToken,
    },
    cache: 'no-store',
  });

  const body = await parseJsonResponse(response);

  if (!response.ok) {
    throw toPublicApiError(response.status, body);
  }

  return body as CanonicalOrder;
}

export function getOrCreatePendingOrderAttempt(fingerprint: string) {
  const existingAttempt = readPendingOrderAttempt();

  if (existingAttempt && existingAttempt.fingerprint === fingerprint) {
    return existingAttempt.idempotencyKey;
  }

  const nextAttempt: PendingOrderAttempt = {
    idempotencyKey: createIdempotencyKey(),
    fingerprint,
    createdAt: Date.now(),
  };

  writePendingOrderAttempt(nextAttempt);
  return nextAttempt.idempotencyKey;
}

export function clearPendingOrderAttempt() {
  removeStorage(PENDING_ORDER_ATTEMPT_KEY, 'localStorage');
  removeStorage(PENDING_ORDER_ATTEMPT_SESSION_KEY, 'sessionStorage');
}

export function shouldResetPendingOrderAttempt(error: PublicOrderApiError) {
  if (error.status >= 500) {
    return false;
  }

  if (error.status === 0) {
    return false;
  }

  return true;
}

export function persistLastOrder(order: CanonicalOrder, accessToken: string) {
  const summary: StoredOrderSummary = {
    orderId: order.order_id,
    orderNumber: order.order_number,
    accessToken,
    subtotal: order.subtotal,
    deliveryFee: order.delivery_fee,
    discountAmount: order.discount_amount,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    paymentData: order.payment_data,
    totalAmount: order.total_amount,
    status: order.status,
    statusHistory: order.status_history,
    estimatedTimeMinutes: order.estimated_time_minutes,
    fulfillmentType: order.fulfillment_type,
    deliveryAddress: order.delivery_address,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    storedAt: Date.now(),
  };

  writeStorage(LAST_ORDER_SUMMARY_KEY, summary, 'localStorage');
  writeStorage(LAST_ORDER_SUMMARY_SESSION_KEY, summary, 'sessionStorage');
  writePlainStorage(LAST_ORDER_ID_KEY, summary.orderId, 'localStorage');
  writePlainStorage(LAST_ORDER_ID_SESSION_KEY, summary.orderId, 'sessionStorage');
  writePlainStorage(LAST_ORDER_ACCESS_TOKEN_KEY, summary.accessToken, 'localStorage');
  writePlainStorage(LAST_ORDER_ACCESS_TOKEN_SESSION_KEY, summary.accessToken, 'sessionStorage');
}

export function readLastOrder(orderId?: string | null): StoredOrderSummary | null {
  const localValue = readStorage<StoredOrderSummary>(LAST_ORDER_SUMMARY_KEY, 'localStorage');
  const sessionValue = readStorage<StoredOrderSummary>(LAST_ORDER_SUMMARY_SESSION_KEY, 'sessionStorage');
  const summary = pickFreshestSummary(localValue, sessionValue);

  if (!summary) {
    return null;
  }

  if (Date.now() - summary.storedAt > STORAGE_TTL_MS) {
    clearOrderStorage();
    return null;
  }

  if (orderId && summary.orderId !== orderId) {
    return null;
  }

  return summary;
}

export function clearOrderStorage() {
  removeStorage(LAST_ORDER_SUMMARY_KEY, 'localStorage');
  removeStorage(LAST_ORDER_SUMMARY_SESSION_KEY, 'sessionStorage');
  removeStorage(LAST_ORDER_ID_KEY, 'localStorage');
  removeStorage(LAST_ORDER_ID_SESSION_KEY, 'sessionStorage');
  removeStorage(LAST_ORDER_ACCESS_TOKEN_KEY, 'localStorage');
  removeStorage(LAST_ORDER_ACCESS_TOKEN_SESSION_KEY, 'sessionStorage');
}

export function persistOrderAccessToken(orderId: string, accessToken: string) {
  writePlainStorage(buildOrderTokenStorageKey(orderId), accessToken, 'localStorage');
  writePlainStorage(buildOrderTokenSessionKey(orderId), accessToken, 'sessionStorage');
}

export function readOrderAccessToken(orderId: string) {
  const sessionValue = readPlainStorage(buildOrderTokenSessionKey(orderId), 'sessionStorage');
  const localValue = readPlainStorage(buildOrderTokenStorageKey(orderId), 'localStorage');
  return sessionValue ?? localValue ?? null;
}

export function toStoredOrderSummary(order: CanonicalOrder, accessToken: string): StoredOrderSummary {
  return {
    orderId: order.order_id,
    orderNumber: order.order_number,
    accessToken,
    subtotal: order.subtotal,
    deliveryFee: order.delivery_fee,
    discountAmount: order.discount_amount,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    paymentData: order.payment_data,
    totalAmount: order.total_amount,
    status: order.status,
    statusHistory: order.status_history,
    estimatedTimeMinutes: order.estimated_time_minutes,
    fulfillmentType: order.fulfillment_type,
    deliveryAddress: order.delivery_address,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    storedAt: Date.now(),
  };
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new PublicOrderApiError(
      500,
      'INVALID_API_RESPONSE',
      'The backend returned an invalid JSON response.',
    );
  }
}

function toPublicApiError(status: number, body: unknown) {
  if (isErrorResponseBody(body)) {
    return new PublicOrderApiError(status, body.code, body.message, body.field);
  }

  return new PublicOrderApiError(status, 'UNEXPECTED_API_ERROR', 'Unexpected API error while processing the order.');
}

function isErrorResponseBody(value: unknown): value is ErrorResponseBody {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ErrorResponseBody>;
  return typeof candidate.code === 'string' && typeof candidate.message === 'string';
}

function writeStorage<T>(key: string, value: T, storageName: 'localStorage' | 'sessionStorage') {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window[storageName].setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures and rely on the alternate storage.
  }
}

function writePlainStorage(key: string, value: string, storageName: 'localStorage' | 'sessionStorage') {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window[storageName].setItem(key, value);
  } catch {
    // Ignore storage failures and rely on the alternate storage.
  }
}

function readPlainStorage(key: string, storageName: 'localStorage' | 'sessionStorage') {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window[storageName].getItem(key);
  } catch {
    return null;
  }
}

function readStorage<T>(key: string, storageName: 'localStorage' | 'sessionStorage') {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window[storageName].getItem(key);

    if (!rawValue) {
      return null;
    }

    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}

function removeStorage(key: string, storageName: 'localStorage' | 'sessionStorage') {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window[storageName].removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

function pickFreshestSummary(
  localValue: StoredOrderSummary | null,
  sessionValue: StoredOrderSummary | null,
) {
  if (!localValue) {
    return sessionValue;
  }

  if (!sessionValue) {
    return localValue;
  }

  return localValue.storedAt >= sessionValue.storedAt ? localValue : sessionValue;
}

function readPendingOrderAttempt() {
  const sessionValue = readStorage<PendingOrderAttempt>(PENDING_ORDER_ATTEMPT_SESSION_KEY, 'sessionStorage');
  const localValue = readStorage<PendingOrderAttempt>(PENDING_ORDER_ATTEMPT_KEY, 'localStorage');
  const attempt = pickLatestAttempt(localValue, sessionValue);

  if (!attempt) {
    return null;
  }

  if (Date.now() - attempt.createdAt > STORAGE_TTL_MS) {
    clearPendingOrderAttempt();
    return null;
  }

  return attempt;
}

function writePendingOrderAttempt(attempt: PendingOrderAttempt) {
  writeStorage(PENDING_ORDER_ATTEMPT_KEY, attempt, 'localStorage');
  writeStorage(PENDING_ORDER_ATTEMPT_SESSION_KEY, attempt, 'sessionStorage');
}

function pickLatestAttempt(
  localValue: PendingOrderAttempt | null,
  sessionValue: PendingOrderAttempt | null,
) {
  if (!localValue) {
    return sessionValue;
  }

  if (!sessionValue) {
    return localValue;
  }

  return localValue.createdAt >= sessionValue.createdAt ? localValue : sessionValue;
}

function buildOrderTokenStorageKey(orderId: string) {
  return `restaurante:order-access-token:${orderId}`;
}

function buildOrderTokenSessionKey(orderId: string) {
  return `restaurante:order-access-token:${orderId}:session`;
}

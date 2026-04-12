import { NextResponse } from 'next/server';
import { ensureApiError, errorResponseBody, parseJsonBody } from '@/lib/api/errors';
import { createOrder } from '@/lib/api/orders';

export async function POST(request: Request) {
  try {
    const payload = await parseJsonBody(request);
    const idempotencyKey = request.headers.get('Idempotency-Key') ?? '';
    const result = await createOrder(payload, idempotencyKey);

    return NextResponse.json(result.order, {
      status: 201,
      headers: {
        'Idempotency-Key': idempotencyKey.trim(),
        'X-Idempotency-Replay': String(result.idempotentReplay),
        'Order-Access-Token': result.accessToken,
      },
    });
  } catch (error) {
    const apiError = ensureApiError(error, {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unexpected server error while creating the order.',
    });

    return NextResponse.json(errorResponseBody(apiError), {
      status: apiError.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  }
}

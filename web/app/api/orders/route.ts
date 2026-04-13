import { NextResponse } from 'next/server';
import { ensureApiError, errorResponseBody, parseJsonBody } from '@/lib/api/errors';
import { createOrder } from '@/lib/api/orders';

export async function POST(request: Request) {
  const debugMode = request.headers.get('X-Debug-Order-Error') === '1';

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
    const errorDetails = serializeOrderError(error);

    console.error('POST /api/orders failed', errorDetails);

    const apiError = ensureApiError(error, {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unexpected server error while creating the order.',
    });

    const baseBody = errorResponseBody(apiError);
    const body: Record<string, unknown> = {
      code: baseBody.code,
      message: baseBody.message,
      field: baseBody.field,
    };

    if (debugMode) {
      body.debug = errorDetails;
    }

    return NextResponse.json(body, {
      status: apiError.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  }
}

function serializeOrderError(error: unknown) {
  if (error instanceof Error) {
    const details: Record<string, unknown> = {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };

    if ('cause' in error) {
      details.cause = error.cause ?? null;
    }

     if ('details' in error) {
      details.details = (error as { details?: unknown }).details ?? null;
    }

    return details;
  }

  return {
    name: typeof error,
    message: String(error),
    stack: null,
    cause: null,
  };
}

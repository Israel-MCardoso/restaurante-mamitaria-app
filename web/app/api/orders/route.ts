import { NextResponse } from 'next/server';
import { ApiError, ensureApiError, errorResponseBody, parseJsonBody } from '@/lib/api/errors';
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
    const errorDetails = serializeOrderError(error);

    console.error('POST /api/orders failed', errorDetails);

    const apiError = ensureApiError(error, {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Não foi possível concluir o pedido agora. Tente novamente em instantes.',
    });

    return NextResponse.json(errorResponseBody(apiError), {
      status: apiError.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  }
}

function serializeOrderError(error: unknown) {
  const isProduction = process.env.NODE_ENV === 'production';

  if (error instanceof ApiError) {
    return {
      name: error.name,
      status: error.status,
      code: error.code,
      field: error.field ?? null,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    const details: Record<string, unknown> = {
      name: error.name,
      message: error.message,
      stack: isProduction ? null : error.stack ?? null,
    };

    if ('cause' in error) {
      details.cause = error.cause ?? null;
    }

    if (!isProduction && 'details' in error) {
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

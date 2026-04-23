import { NextResponse } from 'next/server';
import { ensureApiError, errorResponseBody, parseJsonBody } from '@/lib/api/errors';
import { calculateOrderQuote, type QuoteRequest } from '@/lib/checkout/pricing';

export async function POST(request: Request) {
  try {
    const payload = await parseJsonBody<QuoteRequest>(request);
    const quote = await calculateOrderQuote(payload);
    return NextResponse.json(quote, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  } catch (error) {
    const apiError = ensureApiError(error, {
      status: 500,
      code: 'QUOTE_FAILED',
      message: 'Nao foi possivel calcular o resumo do pedido agora.',
    });

    return NextResponse.json(errorResponseBody(apiError), {
      status: apiError.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  }
}

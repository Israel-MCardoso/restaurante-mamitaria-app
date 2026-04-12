import { NextResponse } from 'next/server';
import { ensureApiError, errorResponseBody } from '@/lib/api/errors';
import { getOrderById } from '@/lib/api/orders';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const url = new URL(request.url);
    const params = await context.params;
    const accessToken =
      request.headers.get('Order-Access-Token') ??
      url.searchParams.get('access_token') ??
      '';

    const order = await getOrderById(params.id, accessToken);

    return NextResponse.json(order, {
      status: 200,
    });
  } catch (error) {
    const apiError = ensureApiError(error, {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unexpected server error while loading the order.',
    });

    return NextResponse.json(errorResponseBody(apiError), {
      status: apiError.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  }
}

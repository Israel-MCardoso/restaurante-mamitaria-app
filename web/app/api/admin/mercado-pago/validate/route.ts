import { NextResponse } from 'next/server';
import { ensureApiError, errorResponseBody, parseJsonBody } from '@/lib/api/errors';
import { requireAdminRequest } from '@/lib/admin/auth';
import { validateMercadoPagoCredentials } from '@/lib/payments/mercado-pago-integration';
import { assertMercadoPagoProvider, logMercadoPagoEvent } from '@/lib/payments/mercado-pago-security';

interface MercadoPagoValidationPayload {
  provider?: string;
  accessToken?: string;
  publicKey?: string | null;
}

export async function POST(request: Request) {
  let restaurantId: string | null = null;

  try {
    const adminContext = await requireAdminRequest(request);
    restaurantId = adminContext.restaurantId;
    const payload = await parseJsonBody<MercadoPagoValidationPayload>(request);

    assertMercadoPagoProvider(payload.provider ?? 'mercado_pago');

    const result = await validateMercadoPagoCredentials({
      accessToken: payload.accessToken ?? '',
      publicKey: payload.publicKey ?? null,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const apiError = ensureApiError(error, {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Não foi possível validar as credenciais do Mercado Pago.',
    });

    logMercadoPagoEvent(
      'admin.validate_failed',
      {
        route: 'POST /api/admin/mercado-pago/validate',
        restaurantId,
        code: apiError.code,
      },
      error,
    );

    return NextResponse.json(errorResponseBody(apiError), { status: apiError.status });
  }
}

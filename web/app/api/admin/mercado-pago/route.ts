import { NextResponse } from 'next/server';
import { ApiError, ensureApiError, errorResponseBody, parseJsonBody } from '@/lib/api/errors';
import { requireAdminRequest } from '@/lib/admin/auth';
import {
  getRestaurantMercadoPagoIntegrationStatus,
  setRestaurantMercadoPagoIntegrationEnabled,
  upsertRestaurantMercadoPagoIntegration,
} from '@/lib/payments/mercado-pago-integration';
import {
  assertMercadoPagoProvider,
  logMercadoPagoEvent,
} from '@/lib/payments/mercado-pago-security';

interface MercadoPagoIntegrationPayload {
  provider?: string;
  accessToken?: string;
  publicKey?: string;
  webhookSecret?: string | null;
  isEnabled?: boolean;
}

export async function GET(request: Request) {
  let restaurantId: string | null = null;

  try {
    const adminContext = await requireAdminRequest(request);
    restaurantId = adminContext.restaurantId;
    const status = await getRestaurantMercadoPagoIntegrationStatus(adminContext.restaurantId);
    return NextResponse.json(status, { status: 200 });
  } catch (error) {
    const apiError = ensureApiError(error, {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Não foi possível carregar a integração do Mercado Pago.',
    });

    logMercadoPagoEvent(
      'admin.status_failed',
      {
        route: 'GET /api/admin/mercado-pago',
        restaurantId,
        code: apiError.code,
      },
      error,
    );

    return NextResponse.json(errorResponseBody(apiError), { status: apiError.status });
  }
}

export async function PUT(request: Request) {
  let restaurantId: string | null = null;

  try {
    const adminContext = await requireAdminRequest(request);
    restaurantId = adminContext.restaurantId;
    const payload = await parseJsonBody<MercadoPagoIntegrationPayload>(request);

    assertMercadoPagoProvider(payload.provider ?? 'mercado_pago');

    const hasCredentials =
      typeof payload.accessToken === 'string' &&
      payload.accessToken.trim().length > 0 &&
      typeof payload.publicKey === 'string' &&
      payload.publicKey.trim().length > 0;
    const hasPartialCredentials =
      (typeof payload.accessToken === 'string' && payload.accessToken.trim().length > 0) !==
      (typeof payload.publicKey === 'string' && payload.publicKey.trim().length > 0);
    const hasToggleFlag = typeof payload.isEnabled === 'boolean';

    if (!hasCredentials && !hasToggleFlag) {
      throw new ApiError(400, 'INVALID_MERCADO_PAGO_PAYLOAD', 'Envie credenciais válidas ou um status explícito para a integração.');
    }

    if (hasPartialCredentials) {
      throw new ApiError(400, 'MERCADO_PAGO_CREDENTIALS_INCOMPLETE', 'Informe Access Token e Public Key juntos para atualizar a integração.');
    }

    if (payload.isEnabled === true && !hasCredentials) {
      const currentStatus = await getRestaurantMercadoPagoIntegrationStatus(adminContext.restaurantId);

      if (!currentStatus.isConfigured) {
        throw new ApiError(400, 'MERCADO_PAGO_INTEGRATION_INCOMPLETE', 'Salve credenciais válidas antes de ativar o Pix.');
      }
    }

    const status = hasCredentials
      ? await upsertRestaurantMercadoPagoIntegration({
          restaurantId: adminContext.restaurantId,
          accessToken: payload.accessToken ?? '',
          publicKey: payload.publicKey ?? '',
          webhookSecret: payload.webhookSecret ?? null,
          isEnabled: payload.isEnabled === true,
        })
      : await setRestaurantMercadoPagoIntegrationEnabled(adminContext.restaurantId, payload.isEnabled === true);

    return NextResponse.json(status, { status: 200 });
  } catch (error) {
    const apiError = ensureApiError(error, {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Não foi possível atualizar a integração do Mercado Pago.',
    });

    logMercadoPagoEvent(
      'admin.update_failed',
      {
        route: 'PUT /api/admin/mercado-pago',
        restaurantId,
        code: apiError.code,
      },
      error,
    );

    return NextResponse.json(errorResponseBody(apiError), { status: apiError.status });
  }
}

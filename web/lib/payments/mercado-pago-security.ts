import { ApiError } from '@/lib/api/errors';

const MERCADO_PAGO_PROVIDER = 'mercado_pago';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type MercadoPagoSecretKind = 'access_token' | 'public_key' | 'webhook_secret';

export function assertMercadoPagoProvider(provider: string | null | undefined) {
  if (!provider || provider !== MERCADO_PAGO_PROVIDER) {
    throw new ApiError(400, 'INVALID_PAYMENT_PROVIDER', 'O provedor de pagamento informado não é suportado.');
  }
}

export function maskMercadoPagoSecret(
  value: string | null | undefined,
  kind: MercadoPagoSecretKind = 'access_token',
) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const visiblePrefixLength = normalized.startsWith('APP_USR-') ? 8 : normalized.startsWith('TEST-') ? 5 : 4;
  const visibleSuffixLength = kind === 'webhook_secret' ? 3 : 4;
  const prefix = normalized.slice(0, Math.min(visiblePrefixLength, normalized.length));
  const suffix = normalized.slice(-Math.min(visibleSuffixLength, normalized.length));

  if (normalized.length <= visiblePrefixLength + visibleSuffixLength) {
    return `${prefix}****`;
  }

  return `${prefix}****${suffix}`;
}

export function redactMercadoPagoText(text: string | null | undefined) {
  if (!text) {
    return '';
  }

  return text
    .replace(/APP_USR-[A-Za-z0-9\-_]+/g, (match) => maskMercadoPagoSecret(match, 'access_token') ?? 'APP_USR-****')
    .replace(/TEST-[A-Za-z0-9\-_]+/g, (match) => maskMercadoPagoSecret(match, 'access_token') ?? 'TEST-****')
    .replace(/Bearer\s+[A-Za-z0-9\-_]+/gi, 'Bearer ****');
}

export function validateMercadoPagoAccessToken(accessToken: string) {
  const normalized = accessToken.trim();

  if (!normalized) {
    throw new ApiError(400, 'MERCADO_PAGO_ACCESS_TOKEN_REQUIRED', 'Informe o Access Token de produção.');
  }

  if (!normalized.startsWith('APP_USR-')) {
    throw new ApiError(400, 'MERCADO_PAGO_ACCESS_TOKEN_INVALID', 'Use o Access Token de produção da conta Mercado Pago do restaurante.');
  }

  if (normalized.length < 20) {
    throw new ApiError(400, 'MERCADO_PAGO_ACCESS_TOKEN_INVALID', 'O Access Token informado parece inválido.');
  }

  return normalized;
}

export function validateMercadoPagoPublicKey(publicKey: string) {
  const normalized = publicKey.trim();

  if (!normalized) {
    throw new ApiError(400, 'MERCADO_PAGO_PUBLIC_KEY_REQUIRED', 'Informe a Public Key de produção.');
  }

  if (!normalized.startsWith('APP_USR-')) {
    throw new ApiError(400, 'MERCADO_PAGO_PUBLIC_KEY_INVALID', 'Use a Public Key de produção da conta Mercado Pago do restaurante.');
  }

  if (normalized.length < 20) {
    throw new ApiError(400, 'MERCADO_PAGO_PUBLIC_KEY_INVALID', 'A Public Key informada parece inválida.');
  }

  return normalized;
}

export function validateMercadoPagoWebhookSecret(webhookSecret: string | null | undefined) {
  const normalized = webhookSecret?.trim() ?? '';

  if (!normalized) {
    return null;
  }

  if (normalized.length < 8) {
    throw new ApiError(400, 'MERCADO_PAGO_WEBHOOK_SECRET_INVALID', 'O webhook secret informado parece inválido.');
  }

  return normalized;
}

export function isUuid(value: string | null | undefined) {
  return Boolean(value && UUID_PATTERN.test(value));
}

export function getSafeMercadoPagoErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof ApiError) {
    return redactMercadoPagoText(error.message);
  }

  if (error instanceof Error) {
    return redactMercadoPagoText(error.message || fallbackMessage);
  }

  return fallbackMessage;
}

export function logMercadoPagoEvent(
  scope: string,
  context: Record<string, unknown>,
  error?: unknown,
) {
  const safeContext = Object.fromEntries(
    Object.entries(context).map(([key, value]) => {
      if (typeof value === 'string') {
        return [key, redactMercadoPagoText(value)];
      }

      return [key, value];
    }),
  );

  if (error) {
    console.error(`[mercado-pago:${scope}]`, {
      ...safeContext,
      error: getSafeMercadoPagoErrorMessage(error, 'Unexpected Mercado Pago error'),
    });
    return;
  }

  console.info(`[mercado-pago:${scope}]`, safeContext);
}

// TODO: When key-management is available, encrypt access_token and webhook_secret at rest.
// TODO: Add persisted last_validated_at and last_validation_status once the schema evolves.

import { ApiError } from '@/lib/api/errors';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  assertMercadoPagoProvider,
  logMercadoPagoEvent,
  maskMercadoPagoSecret,
  redactMercadoPagoText,
  validateMercadoPagoAccessToken,
  validateMercadoPagoPublicKey,
  validateMercadoPagoWebhookSecret,
} from '@/lib/payments/mercado-pago-security';

const MERCADO_PAGO_PROVIDER = 'mercado_pago';
const DEFAULT_APP_URL = 'https://restaurante-mamitaria-app.vercel.app';

export interface MercadoPagoIntegrationRecord {
  id: string;
  restaurant_id: string;
  provider: 'mercado_pago';
  access_token: string;
  public_key: string;
  webhook_secret: string | null;
  webhook_url: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface MercadoPagoIntegrationStatus {
  provider: 'mercado_pago';
  isEnabled: boolean;
  isConfigured: boolean;
  hasWebhookSecret: boolean;
  accessTokenMasked: string | null;
  publicKeyMasked: string | null;
  webhookSecretMasked: string | null;
  webhookUrl: string;
  updatedAt: string | null;
}

export interface MercadoPagoCredentialsValidationResult {
  valid: boolean;
  accountEmail: string | null;
  accountName: string | null;
  userId: string | null;
  publicKeyLooksValid: boolean;
}

interface MercadoPagoMeResponse {
  id?: number | string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  nickname?: string | null;
}

function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL).trim().replace(/\/+$/, '');
}

export function buildRestaurantMercadoPagoWebhookUrl(restaurantId: string) {
  const baseUrl = getAppUrl();
  return `${baseUrl}/api/webhooks/mercado-pago?restaurant_id=${encodeURIComponent(restaurantId)}`;
}

export async function getRestaurantMercadoPagoIntegration(
  restaurantId: string,
): Promise<MercadoPagoIntegrationRecord | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await (supabase as any)
    .from('restaurant_payment_integrations')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('provider', MERCADO_PAGO_PROVIDER)
    .maybeSingle();

  if (error) {
    logMercadoPagoEvent('integration.lookup_failed', { restaurantId }, error);
    throw new ApiError(500, 'MERCADO_PAGO_INTEGRATION_LOOKUP_FAILED', 'Não foi possível carregar a integração de pagamentos.');
  }

  const integration = (data as MercadoPagoIntegrationRecord | null) ?? null;

  if (integration) {
    assertMercadoPagoProvider(integration.provider);
  }

  return integration;
}

export async function requireEnabledRestaurantMercadoPagoIntegration(restaurantId: string) {
  const integration = await getRestaurantMercadoPagoIntegration(restaurantId);

  if (!integration || !integration.is_enabled) {
    throw new ApiError(
      409,
      'MERCADO_PAGO_NOT_CONFIGURED',
      'O Pix está temporariamente indisponível para este restaurante.',
    );
  }

  if (!integration.access_token?.trim()) {
    throw new ApiError(
      409,
      'MERCADO_PAGO_ACCESS_TOKEN_MISSING',
      'O Pix está temporariamente indisponível para este restaurante.',
    );
  }

  assertMercadoPagoProvider(integration.provider);

  return integration;
}

export async function upsertRestaurantMercadoPagoIntegration(input: {
  restaurantId: string;
  accessToken: string;
  publicKey: string;
  webhookSecret?: string | null;
  isEnabled: boolean;
}) {
  const supabase = getSupabaseAdminClient();
  const accessToken = validateMercadoPagoAccessToken(input.accessToken);
  const publicKey = validateMercadoPagoPublicKey(input.publicKey);
  const webhookSecret = validateMercadoPagoWebhookSecret(input.webhookSecret);

  const { error } = await (supabase as any).from('restaurant_payment_integrations').upsert({
    restaurant_id: input.restaurantId,
    provider: MERCADO_PAGO_PROVIDER,
    access_token: accessToken,
    public_key: publicKey,
    webhook_secret: webhookSecret,
    webhook_url: buildRestaurantMercadoPagoWebhookUrl(input.restaurantId),
    is_enabled: input.isEnabled,
  });

  if (error) {
    logMercadoPagoEvent('integration.save_failed', {
      restaurantId: input.restaurantId,
      provider: MERCADO_PAGO_PROVIDER,
      isEnabled: input.isEnabled,
    }, error);
    throw new ApiError(500, 'MERCADO_PAGO_INTEGRATION_SAVE_FAILED', 'Não foi possível salvar as credenciais do Mercado Pago.');
  }

  logMercadoPagoEvent('integration.saved', {
    restaurantId: input.restaurantId,
    provider: MERCADO_PAGO_PROVIDER,
    isEnabled: input.isEnabled,
  });
  return getRestaurantMercadoPagoIntegrationStatus(input.restaurantId);
}

export async function setRestaurantMercadoPagoIntegrationEnabled(restaurantId: string, isEnabled: boolean) {
  const currentIntegration = await getRestaurantMercadoPagoIntegration(restaurantId);

  if (!currentIntegration) {
    throw new ApiError(404, 'MERCADO_PAGO_INTEGRATION_NOT_FOUND', 'Configure as credenciais do Mercado Pago antes de ativar o Pix.');
  }

  if (isEnabled) {
    validateMercadoPagoAccessToken(currentIntegration.access_token);
    validateMercadoPagoPublicKey(currentIntegration.public_key);
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await (supabase as any)
    .from('restaurant_payment_integrations')
    .update({
      is_enabled: isEnabled,
      webhook_url: buildRestaurantMercadoPagoWebhookUrl(restaurantId),
    })
    .eq('restaurant_id', restaurantId)
    .eq('provider', MERCADO_PAGO_PROVIDER);

  if (error) {
    logMercadoPagoEvent('integration.toggle_failed', {
      restaurantId,
      provider: MERCADO_PAGO_PROVIDER,
      isEnabled,
    }, error);
    throw new ApiError(500, 'MERCADO_PAGO_INTEGRATION_TOGGLE_FAILED', 'Não foi possível atualizar o status da integração.');
  }

  logMercadoPagoEvent('integration.toggled', {
    restaurantId,
    provider: MERCADO_PAGO_PROVIDER,
    isEnabled,
  });
  return getRestaurantMercadoPagoIntegrationStatus(restaurantId);
}

export async function getRestaurantMercadoPagoIntegrationStatus(
  restaurantId: string,
): Promise<MercadoPagoIntegrationStatus> {
  const integration = await getRestaurantMercadoPagoIntegration(restaurantId);

  return {
    provider: 'mercado_pago',
    isEnabled: integration?.is_enabled ?? false,
    isConfigured: Boolean(integration?.access_token && integration?.public_key),
    hasWebhookSecret: Boolean(integration?.webhook_secret),
    accessTokenMasked: maskMercadoPagoSecret(integration?.access_token, 'access_token'),
    publicKeyMasked: maskMercadoPagoSecret(integration?.public_key, 'public_key'),
    webhookSecretMasked: maskMercadoPagoSecret(integration?.webhook_secret, 'webhook_secret'),
    webhookUrl: buildRestaurantMercadoPagoWebhookUrl(restaurantId),
    updatedAt: integration?.updated_at ?? null,
  };
}

export async function validateMercadoPagoCredentials(input: {
  accessToken: string;
  publicKey?: string | null;
}): Promise<MercadoPagoCredentialsValidationResult> {
  const accessToken = validateMercadoPagoAccessToken(input.accessToken);
  const publicKey = input.publicKey ? validateMercadoPagoPublicKey(input.publicKey) : null;

  const response = await fetch('https://api.mercadolibre.com/users/me', {
    method: 'GET',
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const bodyText = redactMercadoPagoText(await response.text());
    logMercadoPagoEvent('credentials.validate_failed', {
      provider: MERCADO_PAGO_PROVIDER,
      responseStatus: response.status,
      accessTokenMasked: maskMercadoPagoSecret(accessToken, 'access_token'),
    });
    throw new ApiError(
      400,
      'MERCADO_PAGO_CREDENTIALS_INVALID',
      bodyText
        ? 'Não foi possível validar o Access Token informado com o Mercado Pago.'
        : 'Não foi possível validar o Access Token informado.',
    );
  }

  const account = (await response.json()) as MercadoPagoMeResponse;
  const accountName =
    [account.first_name, account.last_name].filter(Boolean).join(' ').trim() ||
    account.nickname?.trim() ||
    null;

  return {
    valid: true,
    accountEmail: account.email ?? null,
    accountName,
    userId: account.id ? String(account.id) : null,
    publicKeyLooksValid: looksLikeMercadoPagoPublicKey(publicKey),
  };
}

function looksLikeMercadoPagoPublicKey(value: string | null) {
  if (!value) {
    return false;
  }

  const normalized = value.trim();
  return normalized.startsWith('APP_USR-') || normalized.startsWith('TEST-') || normalized.startsWith('APP_');
}

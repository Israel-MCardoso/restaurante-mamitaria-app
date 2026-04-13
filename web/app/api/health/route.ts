import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

function hasEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;
  return typeof value === 'string' && value.trim().length > 0;
}

type ReadinessCheck = {
  ok: boolean;
  state: string;
};

function ok(state = 'ok'): ReadinessCheck {
  return { ok: true, state };
}

function fail(state: string): ReadinessCheck {
  return { ok: false, state };
}

function classifySupabaseError(message?: string | null) {
  const normalized = `${message ?? ''}`.trim();

  if (!normalized) {
    return 'UNKNOWN_ERROR';
  }

  if (normalized.includes('INVALID_REQUEST')) {
    return 'RPC_READY_INVALID_REQUEST';
  }

  if (normalized.includes('ORDER_NOT_FOUND')) {
    return 'RPC_READY_ORDER_NOT_FOUND';
  }

  if (normalized.includes('Could not find the function public.create_canonical_order')) {
    return 'CREATE_ORDER_RPC_MISSING';
  }

  if (normalized.includes('Could not find the function public.get_canonical_order')) {
    return 'GET_ORDER_RPC_MISSING';
  }

  if (normalized.includes('Could not find the function public.update_order_payment_data')) {
    return 'UPDATE_PAYMENT_RPC_MISSING';
  }

  if (normalized.includes('column access_token does not exist')) {
    return 'ORDERS_ACCESS_TOKEN_COLUMN_MISSING';
  }

  if (normalized.includes('column product_name does not exist')) {
    return 'ORDER_ITEMS_PRODUCT_NAME_COLUMN_MISSING';
  }

  if (normalized.includes('relation') && normalized.includes('does not exist')) {
    return 'TABLE_OR_VIEW_MISSING';
  }

  return 'UNEXPECTED_DB_ERROR';
}

async function runSchemaChecks() {
  const supabase = getSupabaseAdminClient();
  const orderProbeId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : '00000000-0000-4000-8000-000000000001';

  const [ordersAccessTokenResult, orderItemsProductNameResult, createOrderRpcResult, getOrderRpcResult, updatePaymentRpcResult] =
    await Promise.all([
      supabase.from('orders').select('id, access_token').limit(1),
      supabase.from('order_items').select('id, product_name').limit(1),
      supabase.rpc('create_canonical_order', {
        payload: null,
        request_idempotency_key: `health-${orderProbeId}`,
        request_hash: 'healthcheck',
      } as never),
      supabase.rpc('get_canonical_order', {
        order_id_input: orderProbeId,
        request_access_token: 'healthcheck',
      } as never),
      supabase.rpc('update_order_payment_data', {
        order_id_input: orderProbeId,
        payment_status_input: 'pending',
        payment_data_input: null,
      } as never),
    ]);

  const schema = {
    ordersAccessTokenColumn: ordersAccessTokenResult.error
      ? fail(classifySupabaseError(ordersAccessTokenResult.error.message))
      : ok('ORDERS_ACCESS_TOKEN_READY'),
    orderItemsProductNameColumn: orderItemsProductNameResult.error
      ? fail(classifySupabaseError(orderItemsProductNameResult.error.message))
      : ok('ORDER_ITEMS_PRODUCT_NAME_READY'),
    createCanonicalOrderRpc: createOrderRpcResult.error
      ? (() => {
          const state = classifySupabaseError(createOrderRpcResult.error.message);
          return state === 'RPC_READY_INVALID_REQUEST' ? ok(state) : fail(state);
        })()
      : fail('CREATE_ORDER_RPC_UNEXPECTED_SUCCESS'),
    getCanonicalOrderRpc: getOrderRpcResult.error
      ? (() => {
          const state = classifySupabaseError(getOrderRpcResult.error.message);
          return state === 'RPC_READY_ORDER_NOT_FOUND' ? ok(state) : fail(state);
        })()
      : fail('GET_ORDER_RPC_UNEXPECTED_SUCCESS'),
    updateOrderPaymentDataRpc: updatePaymentRpcResult.error
      ? (() => {
          const state = classifySupabaseError(updatePaymentRpcResult.error.message);
          return state === 'RPC_READY_ORDER_NOT_FOUND' ? ok(state) : fail(state);
        })()
      : fail('UPDATE_PAYMENT_RPC_UNEXPECTED_SUCCESS'),
  };

  return {
    dbSchemaReady: Object.values(schema).every((check) => check.ok),
    schema,
  };
}

export async function GET() {
  const checks = {
    nextPublicSupabaseUrl: hasEnv('NEXT_PUBLIC_SUPABASE_URL'),
    nextPublicSupabaseAnonKey: hasEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    supabaseUrl: hasEnv('SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseServiceRoleKey: hasEnv('SUPABASE_SERVICE_ROLE_KEY'),
    mercadoPagoAccessToken: hasEnv('MERCADO_PAGO_ACCESS_TOKEN'),
    mercadoPagoWebhookUrl: hasEnv('MERCADO_PAGO_WEBHOOK_URL'),
    mercadoPagoWebhookSecret: hasEnv('MERCADO_PAGO_WEBHOOK_SECRET'),
  };

  const ready =
    checks.nextPublicSupabaseUrl &&
    checks.nextPublicSupabaseAnonKey &&
    checks.supabaseUrl &&
    checks.supabaseServiceRoleKey;

  if (!ready) {
    return NextResponse.json(
      {
        ok: false,
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
        checks,
        db: null,
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }

  try {
    const db = await runSchemaChecks();

    return NextResponse.json(
      {
        ok: db.dbSchemaReady,
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
        checks,
        db,
        timestamp: new Date().toISOString(),
      },
      {
        status: db.dbSchemaReady ? 200 : 503,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
        checks,
        db: {
          dbSchemaReady: false,
          schema: null,
          state: classifySupabaseError(error instanceof Error ? error.message : null),
        },
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}

import { NextResponse } from 'next/server';

function hasEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;
  return typeof value === 'string' && value.trim().length > 0;
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

  return NextResponse.json(
    {
      ok: ready,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
      checks,
      timestamp: new Date().toISOString(),
    },
    {
      status: ready ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}

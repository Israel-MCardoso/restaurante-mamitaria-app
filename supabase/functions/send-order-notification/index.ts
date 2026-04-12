import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const FCM_SERVER_KEY = Deno.env.get('FCM_SERVER_KEY');

serve(async (req) => {
  const { record } = await req.json();

  // 1. Initialize Supabase Admin
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // 2. Get Admin profiles for this restaurant
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('fcm_token')
    .eq('restaurant_id', record.restaurant_id)
    .in('role', ['admin', 'manager'])
    .not('fcm_token', 'is', null);

  if (!profiles || profiles.length === 0) {
    return new Response(JSON.stringify({ message: 'No tokens found' }), { status: 200 });
  }

  const tokens = profiles.map(p => p.fcm_token);

  // 3. Send via FCM
  const fcmPayload = {
    registration_ids: tokens,
    notification: {
      title: 'Novo Pedido Recebido! 🍔',
      body: `Pedido de ${record.customer_name} no valor de R$ ${record.total_amount}`,
      sound: 'default',
    },
    data: {
      orderId: record.id,
      type: 'NEW_ORDER'
    }
  };

  const response = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `key=${FCM_SERVER_KEY}`,
    },
    body: JSON.stringify(fcmPayload),
  });

  const result = await response.json();

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
})

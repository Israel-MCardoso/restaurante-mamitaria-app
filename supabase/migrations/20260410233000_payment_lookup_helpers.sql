create or replace function public.find_order_id_by_provider_transaction_id(
  provider_transaction_id_input text
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select o.id
  from public.orders o
  where o.payment_data->>'provider_transaction_id' = provider_transaction_id_input
  order by o.created_at desc
  limit 1;
$$;

grant execute on function public.find_order_id_by_provider_transaction_id(text) to anon, authenticated, service_role;

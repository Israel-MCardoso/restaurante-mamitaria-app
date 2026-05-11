alter table public.orders
  add column if not exists printed_at timestamptz,
  add column if not exists customer_printed_at timestamptz,
  add column if not exists kitchen_printed_at timestamptz,
  add column if not exists print_attempts integer not null default 0;

comment on column public.orders.printed_at is 'Timestamp em que as duas vias do pedido foram impressas.';
comment on column public.orders.customer_printed_at is 'Timestamp da impressao da via do cliente.';
comment on column public.orders.kitchen_printed_at is 'Timestamp da impressao da via da cozinha.';
comment on column public.orders.print_attempts is 'Quantidade de tentativas de impressao registradas pelo desktop.';

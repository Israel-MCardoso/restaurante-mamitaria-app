alter table public.orders
  drop constraint if exists orders_payment_method_check;

alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method in ('pix', 'card', 'cash'));

alter table public.orders
  drop constraint if exists orders_cash_pickup_only_check;

alter table public.orders
  add constraint orders_cash_pickup_only_check
  check (
    fulfillment_type <> 'delivery'
    or payment_method <> 'cash'
  );

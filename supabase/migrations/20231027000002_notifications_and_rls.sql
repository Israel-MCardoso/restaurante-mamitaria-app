-- Additional RLS for order_items
CREATE POLICY "Admins can view order items" ON order_items FOR SELECT
USING (order_id IN (SELECT id FROM orders WHERE restaurant_id IN (SELECT restaurant_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Customers can view their order items" ON order_items FOR SELECT
USING (order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid()));

-- Trigger to notify Edge Function on new order
CREATE OR REPLACE FUNCTION public.handle_new_order()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM
    net.http_post(
      url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-order-notification',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
      body := jsonb_build_object('record', row_to_json(NEW))
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: 'net' extension is required for pg_net.
-- Alternatively, use Supabase Webhooks in the Dashboard which is easier.

-- CATEGORIES: Admin manage
CREATE POLICY "Admins can insert categories" ON categories FOR INSERT WITH CHECK (
  restaurant_id IN (SELECT restaurant_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

CREATE POLICY "Admins can update categories" ON categories FOR UPDATE USING (
  restaurant_id IN (SELECT restaurant_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

CREATE POLICY "Admins can delete categories" ON categories FOR DELETE USING (
  restaurant_id IN (SELECT restaurant_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

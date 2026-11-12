-- Supabase Row Level Security policies.
-- Apply after 001_init.sql when deploying on Supabase.
--
-- The BhavAI API connects with the service role (or a direct Postgres
-- connection) and enforces ownership in its service layer. These policies are
-- defence in depth for any direct PostgREST/client access. Replace the demo
-- auth.uid() mapping with your Supabase Auth user ids when Supabase Auth is
-- enabled; BhavAI stores its own users.id values, so map them explicitly.

ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Public storefronts may read active sellers and active products.
DROP POLICY IF EXISTS "public_active_sellers" ON sellers;
CREATE POLICY "public_active_sellers" ON sellers FOR SELECT USING (active = TRUE);
DROP POLICY IF EXISTS "public_active_products" ON products;
CREATE POLICY "public_active_products" ON products FOR SELECT USING (active = TRUE);

-- Confidential pricing rules are never publicly readable.
DROP POLICY IF EXISTS "rules_owner_only" ON seller_rules;
CREATE POLICY "rules_owner_only" ON seller_rules FOR ALL
  USING (seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid()::text));

DROP POLICY IF EXISTS "sellers_owner" ON sellers;
CREATE POLICY "sellers_owner" ON sellers FOR UPDATE
  USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "products_owner" ON products;
CREATE POLICY "products_owner" ON products FOR ALL
  USING (seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid()::text))
  WITH CHECK (seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid()::text));

DROP POLICY IF EXISTS "negotiations_participants" ON negotiations;
CREATE POLICY "negotiations_participants" ON negotiations FOR SELECT
  USING (
    buyer_id IN (SELECT id FROM buyers WHERE user_id = auth.uid()::text)
    OR seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid()::text)
  );

DROP POLICY IF EXISTS "offers_participants" ON offers;
CREATE POLICY "offers_participants" ON offers FOR SELECT
  USING (negotiation_id IN (
    SELECT n.id FROM negotiations n
    LEFT JOIN buyers b ON b.id = n.buyer_id
    LEFT JOIN sellers s ON s.id = n.seller_id
    WHERE b.user_id = auth.uid()::text OR s.user_id = auth.uid()::text
  ));

DROP POLICY IF EXISTS "orders_participants" ON orders;
CREATE POLICY "orders_participants" ON orders FOR SELECT
  USING (
    buyer_id IN (SELECT id FROM buyers WHERE user_id = auth.uid()::text)
    OR seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid()::text)
  );

DROP POLICY IF EXISTS "payments_participants" ON payments;
CREATE POLICY "payments_participants" ON payments FOR SELECT
  USING (order_id IN (
    SELECT o.id FROM orders o
    LEFT JOIN buyers b ON b.id = o.buyer_id
    LEFT JOIN sellers s ON s.id = o.seller_id
    WHERE b.user_id = auth.uid()::text OR s.user_id = auth.uid()::text
  ));

DROP POLICY IF EXISTS "api_keys_owner" ON api_keys;
CREATE POLICY "api_keys_owner" ON api_keys FOR ALL
  USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "audit_owner_read" ON audit_logs;
CREATE POLICY "audit_owner_read" ON audit_logs FOR SELECT
  USING (actor_id = auth.uid()::text);

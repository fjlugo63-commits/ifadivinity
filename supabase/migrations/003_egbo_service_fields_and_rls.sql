-- Migration: Add Egbo service fields and comprehensive RLS policies
-- Applied: 2026-07-06
-- Description: Adds service_type, duration_minutes to products; verified_egbo to profiles;
--              product_id to bookings; and comprehensive RLS policies for bookings and orders.

BEGIN;

-- ============================================================
-- 1. Add Egbo service columns to products
-- ============================================================
ALTER TABLE app_340b9f1944_products
  ADD COLUMN IF NOT EXISTS service_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS duration_minutes integer DEFAULT NULL;

COMMENT ON COLUMN app_340b9f1944_products.service_type IS 'Type of service: null for physical products, "egbo" for Egbo rituals';
COMMENT ON COLUMN app_340b9f1944_products.duration_minutes IS 'Duration in minutes for service-type products';

-- ============================================================
-- 2. Add verified_egbo to profiles (sellers table)
-- ============================================================
ALTER TABLE app_340b9f1944_profiles
  ADD COLUMN IF NOT EXISTS verified_egbo boolean DEFAULT false;

COMMENT ON COLUMN app_340b9f1944_profiles.verified_egbo IS 'Whether seller is verified to offer Egbo services';

-- ============================================================
-- 3. Add product_id reference to bookings
-- ============================================================
ALTER TABLE app_340b9f1944_bookings
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES app_340b9f1944_products(id);

COMMENT ON COLUMN app_340b9f1944_bookings.product_id IS 'Reference to the Egbo service product being booked';

-- Create index for booking lookups
CREATE INDEX IF NOT EXISTS idx_bookings_product_id ON app_340b9f1944_bookings(product_id);
CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON app_340b9f1944_bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_practitioner_id ON app_340b9f1944_bookings(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON app_340b9f1944_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller_id ON app_340b9f1944_order_items(seller_id);

-- ============================================================
-- 4. RLS Policies for BOOKINGS
-- ============================================================
ALTER TABLE app_340b9f1944_bookings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate cleanly
DROP POLICY IF EXISTS "bookings_select_own" ON app_340b9f1944_bookings;
DROP POLICY IF EXISTS "bookings_select_practitioner" ON app_340b9f1944_bookings;
DROP POLICY IF EXISTS "bookings_select_admin" ON app_340b9f1944_bookings;
DROP POLICY IF EXISTS "bookings_update_own" ON app_340b9f1944_bookings;
DROP POLICY IF EXISTS "bookings_update_practitioner" ON app_340b9f1944_bookings;
DROP POLICY IF EXISTS "bookings_update_admin" ON app_340b9f1944_bookings;
DROP POLICY IF EXISTS "bookings_insert_authenticated" ON app_340b9f1944_bookings;

-- Buyers can SELECT their own bookings
CREATE POLICY "bookings_select_own"
  ON app_340b9f1944_bookings
  FOR SELECT
  USING (client_id = auth.uid());

-- Practitioners (sellers) can SELECT bookings assigned to them
CREATE POLICY "bookings_select_practitioner"
  ON app_340b9f1944_bookings
  FOR SELECT
  USING (practitioner_id = auth.uid());

-- Admins can SELECT all bookings
CREATE POLICY "bookings_select_admin"
  ON app_340b9f1944_bookings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app_340b9f1944_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Buyers can UPDATE their own bookings (e.g., cancel)
CREATE POLICY "bookings_update_own"
  ON app_340b9f1944_bookings
  FOR UPDATE
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- Practitioners can UPDATE bookings assigned to them (e.g., confirm, add meeting URL)
CREATE POLICY "bookings_update_practitioner"
  ON app_340b9f1944_bookings
  FOR UPDATE
  USING (practitioner_id = auth.uid())
  WITH CHECK (practitioner_id = auth.uid());

-- Admins can UPDATE any booking
CREATE POLICY "bookings_update_admin"
  ON app_340b9f1944_bookings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM app_340b9f1944_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Authenticated users can INSERT bookings (checkout creates them)
CREATE POLICY "bookings_insert_authenticated"
  ON app_340b9f1944_bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid());

-- ============================================================
-- 5. RLS Policies for ORDERS
-- ============================================================
ALTER TABLE app_340b9f1944_orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate cleanly
DROP POLICY IF EXISTS "orders_select_buyer" ON app_340b9f1944_orders;
DROP POLICY IF EXISTS "orders_select_admin" ON app_340b9f1944_orders;
DROP POLICY IF EXISTS "orders_insert_buyer" ON app_340b9f1944_orders;
DROP POLICY IF EXISTS "orders_update_admin" ON app_340b9f1944_orders;

-- Buyers can SELECT their own orders
CREATE POLICY "orders_select_buyer"
  ON app_340b9f1944_orders
  FOR SELECT
  USING (buyer_id = auth.uid());

-- Admins can SELECT all orders
CREATE POLICY "orders_select_admin"
  ON app_340b9f1944_orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app_340b9f1944_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Buyers can INSERT orders (checkout flow)
CREATE POLICY "orders_insert_buyer"
  ON app_340b9f1944_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (buyer_id = auth.uid());

-- Only admins can UPDATE orders (status changes)
CREATE POLICY "orders_update_admin"
  ON app_340b9f1944_orders
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM app_340b9f1944_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- 6. RLS Policies for ORDER_ITEMS
-- ============================================================
ALTER TABLE app_340b9f1944_order_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate cleanly
DROP POLICY IF EXISTS "order_items_select_buyer" ON app_340b9f1944_order_items;
DROP POLICY IF EXISTS "order_items_select_seller" ON app_340b9f1944_order_items;
DROP POLICY IF EXISTS "order_items_select_admin" ON app_340b9f1944_order_items;
DROP POLICY IF EXISTS "order_items_insert_authenticated" ON app_340b9f1944_order_items;

-- Buyers can SELECT items from their own orders
CREATE POLICY "order_items_select_buyer"
  ON app_340b9f1944_order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app_340b9f1944_orders
      WHERE id = order_id AND buyer_id = auth.uid()
    )
  );

-- Sellers can SELECT order items for their products
CREATE POLICY "order_items_select_seller"
  ON app_340b9f1944_order_items
  FOR SELECT
  USING (seller_id = auth.uid());

-- Admins can SELECT all order items
CREATE POLICY "order_items_select_admin"
  ON app_340b9f1944_order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app_340b9f1944_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Authenticated users can INSERT order items (checkout flow)
CREATE POLICY "order_items_insert_authenticated"
  ON app_340b9f1944_order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

COMMIT;
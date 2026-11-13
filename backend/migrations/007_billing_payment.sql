-- 007_billing_payments.sql
-- Billing calculations, multi-tender payments, refunds, GST invoices & financial audit logs

-- 1. Extend restaurants & branches with optional GSTIN & default billing charges
ALTER TABLE restaurants
  ADD COLUMN gstin VARCHAR(20) NULL AFTER address;

ALTER TABLE branches
  ADD COLUMN gstin VARCHAR(20) NULL AFTER address,
  ADD COLUMN phone VARCHAR(20) NULL AFTER gstin,
  ADD COLUMN service_charge_rate DECIMAL(5, 2) NOT NULL DEFAULT 0.00 AFTER phone;

-- 2. Extend orders with billing & payment tracking columns (reusing existing subtotal, tax_total, discount_total, grand_total)
ALTER TABLE orders
  ADD COLUMN discount_type ENUM('NONE', 'PERCENTAGE', 'FLAT') NOT NULL DEFAULT 'NONE' AFTER subtotal,
  ADD COLUMN discount_value DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER discount_type,
  ADD COLUMN service_charge_rate DECIMAL(5, 2) NOT NULL DEFAULT 0.00 AFTER discount_total,
  ADD COLUMN service_charge_total DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER service_charge_rate,
  ADD COLUMN round_off DECIMAL(6, 2) NOT NULL DEFAULT 0.00 AFTER tax_total,
  ADD COLUMN amount_paid DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER grand_total,
  ADD COLUMN balance_due DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER amount_paid,
  ADD COLUMN payment_status ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED') NOT NULL DEFAULT 'UNPAID' AFTER balance_due;

-- Backfill balance_due for existing unpaid orders
UPDATE orders SET balance_due = grand_total WHERE amount_paid = 0 AND balance_due = 0;

-- 3. Order Tax Breakdown (CGST / SGST / IGST reporting snapshots)
CREATE TABLE IF NOT EXISTS order_tax_breakdowns (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  tax_name VARCHAR(50) NOT NULL,
  tax_rate DECIMAL(5, 2) NOT NULL,
  taxable_amount DECIMAL(12, 2) NOT NULL,
  tax_amount DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_tax_breakdown_order (order_id)
);

-- 4. Order Payments (Supports Cash, Card, UPI, Partial & Split Payments)
CREATE TABLE IF NOT EXISTS order_payments (
  id VARCHAR(36) PRIMARY KEY,
  restaurant_id VARCHAR(36) NOT NULL,
  branch_id VARCHAR(36) NOT NULL,
  order_id VARCHAR(36) NOT NULL,
  payment_method ENUM('CASH', 'CARD', 'UPI') NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  tendered_amount DECIMAL(12, 2) NULL,
  change_returned DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  reference_number VARCHAR(100) NULL,
  status ENUM('COMPLETED', 'FAILED', 'VOIDED') NOT NULL DEFAULT 'COMPLETED',
  idempotency_key VARCHAR(64) NOT NULL,
  notes VARCHAR(255) NULL,
  recorded_by_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by_id) REFERENCES users(id),
  UNIQUE KEY uq_branch_payment_idempotency (branch_id, idempotency_key),
  INDEX idx_order_payments_order (order_id),
  INDEX idx_order_payments_branch_created (branch_id, created_at DESC)
);

-- 5. Payment Refunds (Immutable refund ledger)
CREATE TABLE IF NOT EXISTS payment_refunds (
  id VARCHAR(36) PRIMARY KEY,
  restaurant_id VARCHAR(36) NOT NULL,
  branch_id VARCHAR(36) NOT NULL,
  order_id VARCHAR(36) NOT NULL,
  payment_id VARCHAR(36) NOT NULL,
  refund_method ENUM('CASH', 'CARD', 'UPI') NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  reason TEXT NOT NULL,
  reference_number VARCHAR(100) NULL,
  idempotency_key VARCHAR(64) NOT NULL,
  refunded_by_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (payment_id) REFERENCES order_payments(id) ON DELETE RESTRICT,
  FOREIGN KEY (refunded_by_id) REFERENCES users(id),
  UNIQUE KEY uq_branch_refund_idempotency (branch_id, idempotency_key),
  INDEX idx_refunds_order (order_id),
  INDEX idx_refunds_payment (payment_id)
);

-- 6. Invoices (Sequential branch invoice numbers + immutable snapshot)
CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(36) PRIMARY KEY,
  restaurant_id VARCHAR(36) NOT NULL,
  branch_id VARCHAR(36) NOT NULL,
  order_id VARCHAR(36) NOT NULL UNIQUE,
  invoice_number VARCHAR(60) NOT NULL,
  gstin VARCHAR(20) NULL,
  customer_name VARCHAR(120) NULL,
  customer_phone VARCHAR(32) NULL,
  invoice_snapshot JSON NOT NULL,
  issued_by_id VARCHAR(36) NOT NULL,
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (issued_by_id) REFERENCES users(id),
  UNIQUE KEY uq_branch_invoice_number (branch_id, invoice_number),
  INDEX idx_invoices_branch_issued (branch_id, issued_at DESC)
);

-- 7. Financial Audit Logs
CREATE TABLE IF NOT EXISTS financial_audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  restaurant_id VARCHAR(36) NOT NULL,
  branch_id VARCHAR(36) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  actor_user_id VARCHAR(36) NOT NULL,
  before_state JSON NULL,
  after_state JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_user_id) REFERENCES users(id),
  INDEX idx_audit_branch_created (branch_id, created_at DESC)
);
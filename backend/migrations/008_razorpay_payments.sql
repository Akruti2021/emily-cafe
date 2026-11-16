-- 008_razorpay_payments.sql
ALTER TABLE order_payments
  MODIFY COLUMN payment_method ENUM('CASH', 'CARD', 'UPI', 'RAZORPAY') NOT NULL,
  ADD COLUMN gateway_order_id VARCHAR(100) NULL AFTER reference_number,
  ADD COLUMN gateway_payment_id VARCHAR(100) NULL AFTER gateway_order_id,
  ADD COLUMN gateway_signature VARCHAR(255) NULL AFTER gateway_payment_id,
  ADD UNIQUE KEY uq_order_payments_gateway_payment_id (gateway_payment_id);
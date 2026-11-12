-- Customer records are shared by branches within a restaurant.
-- Apply only after reviewing the target database's migration history.
CREATE TABLE customers (
  id VARCHAR(36) PRIMARY KEY,
  restaurant_id VARCHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(32) NULL,
  email VARCHAR(191) NULL,
  notes TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  UNIQUE KEY uq_customers_restaurant_email (restaurant_id, email),
  UNIQUE KEY uq_customers_restaurant_id (restaurant_id, id),
  INDEX idx_customers_restaurant_name (restaurant_id, name),
  INDEX idx_customers_restaurant_phone (restaurant_id, phone)
);

ALTER TABLE orders
  ADD COLUMN customer_id VARCHAR(36) NULL,
  ADD INDEX idx_orders_customer_created (customer_id, created_at),
  ADD CONSTRAINT fk_orders_customer
    FOREIGN KEY (restaurant_id, customer_id) REFERENCES customers(restaurant_id, id) ON DELETE RESTRICT;

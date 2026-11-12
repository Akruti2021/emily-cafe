CREATE DATABASE IF NOT EXISTS emily_cafe_db;
USE emily_cafe_db;

-- 1. Users & Auth Module
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(191) NOT NULL UNIQUE,
  mobile_number VARCHAR(15) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'USER',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_refresh_user (user_id)
);

CREATE TABLE IF NOT EXISTS password_resets (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_reset_user (user_id)
);

-- 2. Organizations & Branches (Multi-Tenant)
CREATE TABLE IF NOT EXISTS restaurants (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  owner_user_id VARCHAR(36) NOT NULL,
  address TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS branches (
  id VARCHAR(36) PRIMARY KEY,
  restaurant_id VARCHAR(36) NOT NULL,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(160) NOT NULL,
  address TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  UNIQUE KEY uq_restaurant_branch_code (restaurant_id, code)
);

CREATE TABLE IF NOT EXISTS dining_areas (
  id VARCHAR(36) PRIMARY KEY,
  branch_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  UNIQUE KEY uq_branch_dining_area_name (branch_id, name),
  INDEX idx_dining_areas_branch_status (branch_id, status)
);

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id VARCHAR(36) PRIMARY KEY,
  dining_area_id VARCHAR(36) NOT NULL,
  table_number VARCHAR(40) NOT NULL,
  capacity TINYINT UNSIGNED NOT NULL DEFAULT 2,
  status VARCHAR(24) NOT NULL DEFAULT 'available',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (dining_area_id) REFERENCES dining_areas(id) ON DELETE CASCADE,
  UNIQUE KEY uq_area_table_number (dining_area_id, table_number),
  INDEX idx_restaurant_tables_status (dining_area_id, status)
);

CREATE TABLE IF NOT EXISTS branch_users (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  branch_id VARCHAR(36) NOT NULL,
  role VARCHAR(30) NOT NULL,
  assigned_by_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_branch_users_role CHECK (
    role IN ('BRANCH_MANAGER', 'CASHIER', 'WAITER', 'KITCHEN_STAFF', 'INVENTORY_MANAGER', 'ACCOUNTANT')
  ),
  UNIQUE KEY uq_branch_users_user_branch (user_id, branch_id),
  INDEX idx_branch_users_branch_role (branch_id, role),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by_id) REFERENCES users(id)
);

-- 3. Menu & Categories
CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(36) PRIMARY KEY,
  restaurant_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS menu_items (
  id VARCHAR(36) PRIMARY KEY,
  restaurant_id VARCHAR(36) NOT NULL,
  category_id VARCHAR(36) NOT NULL,
  name VARCHAR(180) NOT NULL,
  description TEXT NULL,
  base_price DECIMAL(12, 2) NOT NULL,
  tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  INDEX idx_menu_restaurant (restaurant_id),
  INDEX idx_menu_category (category_id)
);

CREATE TABLE IF NOT EXISTS customers (
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

-- 4. Orders & Order Items
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(36) PRIMARY KEY,
  restaurant_id VARCHAR(36) NOT NULL,
  branch_id VARCHAR(36) NOT NULL,
  table_id VARCHAR(36) NULL,
  order_number VARCHAR(60) NOT NULL,
  order_type VARCHAR(20) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  tax_total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  discount_total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  grand_total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  created_by_id VARCHAR(36) NULL,
  customer_id VARCHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_id) REFERENCES users(id),
  FOREIGN KEY (table_id) REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  FOREIGN KEY (restaurant_id, customer_id) REFERENCES customers(restaurant_id, id) ON DELETE RESTRICT,
  UNIQUE KEY uq_branch_order (branch_id, order_number),
  INDEX idx_orders_branch_created (branch_id, created_at DESC),
  INDEX idx_orders_customer_created (customer_id, created_at)
);

CREATE TABLE IF NOT EXISTS order_items (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  menu_item_id VARCHAR(36) NULL,
  item_name_snapshot VARCHAR(180) NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  quantity DECIMAL(12, 3) NOT NULL,
  line_total DECIMAL(12, 2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL,
  INDEX idx_order_items_order (order_id)
);

-- 5. Kitchen Order Tickets and item-level preparation state.
CREATE TABLE IF NOT EXISTS kots (
  id VARCHAR(36) PRIMARY KEY,
  branch_id VARCHAR(36) NOT NULL,
  order_id VARCHAR(36) NOT NULL,
  kot_number VARCHAR(60) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'New',
  sent_by_id VARCHAR(36) NOT NULL,
  sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ready_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (sent_by_id) REFERENCES users(id),
  UNIQUE KEY uq_kot_branch_number (branch_id, kot_number),
  UNIQUE KEY uq_kots_order (order_id),
  INDEX idx_kots_branch_status_sent (branch_id, status, sent_at),
  INDEX idx_kots_order (order_id)
);

CREATE TABLE IF NOT EXISTS kot_items (
  id VARCHAR(36) PRIMARY KEY,
  kot_id VARCHAR(36) NOT NULL,
  order_item_id VARCHAR(36) NOT NULL,
  quantity DECIMAL(12, 3) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'New',
  instructions TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (kot_id) REFERENCES kots(id) ON DELETE CASCADE,
  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
  INDEX idx_kot_items_ticket_status (kot_id, status)
);

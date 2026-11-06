-- Additive menu customization support. The live development database already
-- has these four tables; this migration records the schema for fresh installs.
CREATE TABLE IF NOT EXISTS menu_item_variants (
  id VARCHAR(36) PRIMARY KEY,
  menu_item_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  price_delta DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  INDEX idx_menu_variants_item_status_sort (menu_item_id, status, sort_order)
);

CREATE TABLE IF NOT EXISTS menu_item_addon_groups (
  id VARCHAR(36) PRIMARY KEY,
  menu_item_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  min_selections INT NOT NULL DEFAULT 0,
  max_selections INT NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  INDEX idx_menu_addon_groups_item_status_sort (menu_item_id, status, sort_order)
);

CREATE TABLE IF NOT EXISTS menu_item_addons (
  id VARCHAR(36) PRIMARY KEY,
  group_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  price_delta DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES menu_item_addon_groups(id) ON DELETE CASCADE,
  INDEX idx_menu_addons_group_status_sort (group_id, status, sort_order)
);

CREATE TABLE IF NOT EXISTS order_item_customizations (
  id VARCHAR(36) PRIMARY KEY,
  order_item_id VARCHAR(36) NOT NULL,
  customization_type VARCHAR(20) NOT NULL,
  variant_id VARCHAR(36) NULL,
  addon_id VARCHAR(36) NULL,
  name_snapshot VARCHAR(100) NOT NULL,
  price_delta_snapshot DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
  FOREIGN KEY (variant_id) REFERENCES menu_item_variants(id) ON DELETE SET NULL,
  FOREIGN KEY (addon_id) REFERENCES menu_item_addons(id) ON DELETE SET NULL,
  INDEX idx_order_item_customizations_item (order_item_id)
);

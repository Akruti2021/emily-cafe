-- 009_reservations.sql
CREATE TABLE IF NOT EXISTS reservations (
  id CHAR(36) NOT NULL,
  restaurant_id CHAR(36) NOT NULL,
  branch_id CHAR(36) NOT NULL,
  customer_id CHAR(36) NULL,
  guest_name VARCHAR(120) NOT NULL,
  guest_phone VARCHAR(30) NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  guests INT UNSIGNED NOT NULL,
  status ENUM('PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW') NOT NULL DEFAULT 'CONFIRMED',
  notes TEXT NULL,
  created_by CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_reservations_branch_time (branch_id, starts_at, ends_at, status),
  KEY idx_reservations_customer (customer_id),
  CONSTRAINT fk_reservations_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE,
  CONSTRAINT fk_reservations_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE CASCADE,
  CONSTRAINT fk_reservations_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Junction table supporting 1 or multiple tables per reservation
CREATE TABLE IF NOT EXISTS reservation_tables (
  reservation_id CHAR(36) NOT NULL,
  table_id CHAR(36) NOT NULL,
  PRIMARY KEY (reservation_id, table_id),
  KEY idx_reservation_tables_table (table_id),
  CONSTRAINT fk_res_tables_reservation FOREIGN KEY (reservation_id) REFERENCES reservations (id) ON DELETE CASCADE,
  CONSTRAINT fk_res_tables_table FOREIGN KEY (table_id) REFERENCES restaurant_tables (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
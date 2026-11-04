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
  CONSTRAINT fk_kots_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  CONSTRAINT fk_kots_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_kots_sender FOREIGN KEY (sent_by_id) REFERENCES users(id),
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
  CONSTRAINT fk_kot_items_kot FOREIGN KEY (kot_id) REFERENCES kots(id) ON DELETE CASCADE,
  CONSTRAINT fk_kot_items_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
  INDEX idx_kot_items_ticket_status (kot_id, status)
);

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
  CONSTRAINT fk_branch_users_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_branch_users_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  CONSTRAINT fk_branch_users_assigned_by FOREIGN KEY (assigned_by_id) REFERENCES users(id)
);

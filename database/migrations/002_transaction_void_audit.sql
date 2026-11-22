-- Soft-delete/void transaksi + audit trail retur.
-- Portable MySQL/MariaDB: cek information_schema sebelum ALTER.

-- status
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND COLUMN_NAME = 'status'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE transactions ADD COLUMN status ENUM(''active'',''voided'') NOT NULL DEFAULT ''active'' AFTER notes',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- voided_at
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND COLUMN_NAME = 'voided_at'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE transactions ADD COLUMN voided_at DATETIME NULL AFTER status',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- voided_by
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND COLUMN_NAME = 'voided_by'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE transactions ADD COLUMN voided_by BIGINT UNSIGNED NULL AFTER voided_at',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- void_reason
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND COLUMN_NAME = 'void_reason'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE transactions ADD COLUMN void_reason VARCHAR(200) NULL AFTER voided_by',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- index (status, created_at)
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND INDEX_NAME = 'idx_transactions_status_date'
);
SET @sql := IF(@idx_exists = 0,
  'ALTER TABLE transactions ADD INDEX idx_transactions_status_date (status, created_at)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FK voided_by
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND CONSTRAINT_NAME = 'fk_transactions_voided_by'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE transactions ADD CONSTRAINT fk_transactions_voided_by FOREIGN KEY (voided_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS transaction_audits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  transaction_id BIGINT UNSIGNED NOT NULL,
  action ENUM('VOID_TRANSACTION', 'RETURN_ITEM') NOT NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  reason VARCHAR(200) NULL,
  details JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_tx_audits_transaction
    FOREIGN KEY (transaction_id)
    REFERENCES transactions(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_tx_audits_actor
    FOREIGN KEY (actor_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  INDEX idx_tx_audits_tx_created (transaction_id, created_at),
  INDEX idx_tx_audits_actor_created (actor_user_id, created_at)
) ENGINE=InnoDB;

-- Append the enum value to preserve existing MySQL enum indexes.
ALTER TABLE `product_order`
  MODIFY COLUMN `status` ENUM('PENDING_PAYMENT', 'PENDING_INSTALLATION', 'IN_SERVICE', 'COMPLETED', 'CANCELED', 'REFUNDING', 'REFUNDED', 'PENDING_CONFIRMATION') NOT NULL DEFAULT 'PENDING_PAYMENT',
  ADD COLUMN `confirmation_deadline_at` DATETIME(3) NULL,
  ADD COLUMN `completion_type` ENUM('CUSTOMER_CONFIRMED', 'AUTO_TIMEOUT') NULL,
  ADD COLUMN `auto_completion_paused` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `installation_order`
  ADD COLUMN `customer_confirmed_at` DATETIME(3) NULL;

CREATE INDEX `product_order_status_confirmation_deadline_at_idx`
  ON `product_order` (`status`, `confirmation_deadline_at`);

-- Historical completed orders remain unchanged; no inferred confirmation or deadline.

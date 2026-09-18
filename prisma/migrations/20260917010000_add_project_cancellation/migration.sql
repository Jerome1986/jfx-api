ALTER TABLE `renovation_project`
  ADD COLUMN `cancel_reason` VARCHAR(500) NULL,
  ADD COLUMN `canceled_at` DATETIME(3) NULL,
  ADD COLUMN `canceled_by_employee_id` INTEGER NULL;

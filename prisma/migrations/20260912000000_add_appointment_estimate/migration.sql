ALTER TABLE `appointment`
  ADD COLUMN `estimated_amount` DECIMAL(10, 2) NULL,
  ADD COLUMN `estimate_description` VARCHAR(191) NULL,
  ADD COLUMN `estimated_at` DATETIME(3) NULL;

ALTER TABLE `installation_order`
  ADD COLUMN `installer_name` VARCHAR(100) NULL,
  ADD COLUMN `installer_phone` VARCHAR(32) NULL,
  ADD COLUMN `remark` VARCHAR(1000) NULL;

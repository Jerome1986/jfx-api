ALTER TABLE `renovation_project`
  ADD COLUMN `quote_version` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `quote_remark` VARCHAR(500) NULL;

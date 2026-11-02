ALTER TABLE `renovation_project`
  ADD COLUMN `coupon_discount` DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN `coupon_snapshot` JSON NULL,
  ADD COLUMN `coupon_returned_at` DATETIME(3) NULL;
ALTER TABLE `user_coupon` ADD COLUMN `project_id` INTEGER NULL;
CREATE UNIQUE INDEX `user_coupon_project_id_key` ON `user_coupon`(`project_id`);
ALTER TABLE `user_coupon` ADD CONSTRAINT `user_coupon_project_id_fkey`
  FOREIGN KEY (`project_id`) REFERENCES `renovation_project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

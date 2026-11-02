ALTER TABLE `product_sku` ADD COLUMN `deleted_at` DATETIME(3) NULL;
CREATE INDEX `product_sku_product_id_name_idx` ON `product_sku` (`product_id`, `name`);
DROP INDEX `product_sku_product_id_name_key` ON `product_sku`;

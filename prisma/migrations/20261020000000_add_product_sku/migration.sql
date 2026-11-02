CREATE TABLE `product_sku` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `attrs` JSON NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `image` VARCHAR(500) NOT NULL,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `is_enabled` BOOLEAN NOT NULL DEFAULT true,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    INDEX `product_sku_product_id_is_enabled_sort_idx`(`product_id`, `is_enabled`, `sort`),
    UNIQUE INDEX `product_sku_product_id_name_key`(`product_id`, `name`),
    PRIMARY KEY (`id`),
    CONSTRAINT `product_sku_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `cart_item` ADD COLUMN `sku_id` INTEGER NOT NULL;
CREATE UNIQUE INDEX `cart_item_user_id_sku_id_key` ON `cart_item`(`user_id`, `sku_id`);
DROP INDEX `cart_item_user_id_product_id_key` ON `cart_item`;
ALTER TABLE `cart_item` ADD CONSTRAINT `cart_item_sku_id_fkey` FOREIGN KEY (`sku_id`) REFERENCES `product_sku`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `product_order_item` ADD COLUMN `sku_id` INTEGER NOT NULL;
CREATE INDEX `product_order_item_sku_id_idx` ON `product_order_item`(`sku_id`);
ALTER TABLE `product_order_item` ADD CONSTRAINT `product_order_item_sku_id_fkey` FOREIGN KEY (`sku_id`) REFERENCES `product_sku`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `stock_log` ADD COLUMN `sku_id` INTEGER NOT NULL;
CREATE INDEX `stock_log_sku_id_created_at_idx` ON `stock_log`(`sku_id`, `created_at`);
ALTER TABLE `stock_log` ADD CONSTRAINT `stock_log_sku_id_fkey` FOREIGN KEY (`sku_id`) REFERENCES `product_sku`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `product` DROP COLUMN `price`, DROP COLUMN `specifications`, DROP COLUMN `stock`;

-- Expand before JSON encoding so existing 500-character URLs are preserved.
ALTER TABLE `product` MODIFY COLUMN `main_image` LONGTEXT NOT NULL;
UPDATE `product` SET `main_image` = JSON_ARRAY(`main_image`);
ALTER TABLE `product` MODIFY COLUMN `main_image` JSON NOT NULL;

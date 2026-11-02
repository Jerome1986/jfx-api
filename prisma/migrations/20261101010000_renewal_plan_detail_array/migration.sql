-- Only empty old details are initialized. Nonempty text must be reviewed before applying.
UPDATE `renewal_plan` SET `detail` = '[]' WHERE `detail` IS NULL OR TRIM(`detail`) = '';
ALTER TABLE `renewal_plan` MODIFY COLUMN `detail` JSON NOT NULL;

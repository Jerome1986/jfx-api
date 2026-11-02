-- Preserve any uploaded images in the single detail array before removing the redundant column.
UPDATE `renewal_plan` SET `detail` = JSON_MERGE(`detail`, `images`) WHERE JSON_TYPE(`images`) = 'ARRAY' AND JSON_LENGTH(`images`) > 0;
ALTER TABLE `renewal_plan` DROP COLUMN `images`;

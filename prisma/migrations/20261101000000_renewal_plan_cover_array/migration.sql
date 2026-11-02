-- Existing renewal plans have been removed; no legacy data conversion is required.
ALTER TABLE `renewal_plan` MODIFY COLUMN `cover` JSON NOT NULL;

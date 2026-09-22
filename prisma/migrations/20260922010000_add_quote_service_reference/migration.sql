ALTER TABLE `project_quote_item` ADD COLUMN `service_id` INTEGER NULL;
CREATE INDEX `project_quote_item_service_id_idx` ON `project_quote_item`(`service_id`);
ALTER TABLE `project_quote_item`
  ADD CONSTRAINT `project_quote_item_service_id_fkey`
  FOREIGN KEY (`service_id`) REFERENCES `construction_service`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

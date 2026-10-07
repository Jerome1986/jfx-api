ALTER TABLE `renovation_project`
  ADD COLUMN `planned_completion_date` DATE NULL,
  ADD INDEX `project_status_planned_completion_idx` (`status`, `planned_completion_date`);
ALTER TABLE `installation_order`
  ADD COLUMN `scheduled_end_at` DATETIME(3) NULL,
  ADD INDEX `installation_status_scheduled_end_idx` (`status`, `scheduled_end_at`);

-- 预约日期保存日历日期；按北京时间将有效时段结束时间换算为 UTC。
UPDATE `installation_order`
SET `scheduled_end_at` = DATE_SUB(
  TIMESTAMP(DATE(`appointment_date`), STR_TO_DATE(RIGHT(`time_slot`, 5), '%H:%i')),
  INTERVAL 8 HOUR
)
WHERE `appointment_date` IS NOT NULL
  AND CHAR_LENGTH(`time_slot`) = 11
  AND `time_slot` REGEXP '^([01][0-9]|2[0-3]):[0-5][0-9]-([01][0-9]|2[0-3]):[0-5][0-9]$'
  AND LEFT(`time_slot`, 5) < RIGHT(`time_slot`, 5);

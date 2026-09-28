-- 保存成交确认时间，并为个人签约和公司完工业绩建立索引。
ALTER TABLE `renovation_project`
  ADD COLUMN `quote_confirmed_at` DATETIME(3) NULL,
  ADD INDEX `project_employee_status_confirmed_idx` (`employee_id`, `status`, `quote_confirmed_at`),
  ADD INDEX `project_status_completed_employee_idx` (`status`, `completed_at`, `employee_id`);

-- 仅回填有服务中进度的历史项目；缺少记录时不猜测确认时间。
UPDATE `renovation_project` AS project
JOIN (
  SELECT `project_id`, MIN(`created_at`) AS confirmed_at
  FROM `project_progress`
  WHERE `status` = 'IN_SERVICE'
  GROUP BY `project_id`
) AS progress ON progress.project_id = project.id
SET project.quote_confirmed_at = progress.confirmed_at
WHERE project.quote_confirmed_at IS NULL;

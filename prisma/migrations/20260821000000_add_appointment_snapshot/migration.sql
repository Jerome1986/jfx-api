-- 预约联系人姓名改为可选，并保存提交时的方案快照
ALTER TABLE `appointment`
  MODIFY `customer_name` VARCHAR(191) NULL,
  ADD COLUMN `snapshot` JSON NULL;

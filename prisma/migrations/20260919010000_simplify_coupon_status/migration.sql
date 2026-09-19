-- 先扩展枚举，确保旧状态可以安全转换。
ALTER TABLE `coupon`
  MODIFY `status` ENUM('DRAFT', 'NOT_STARTED', 'ACTIVE', 'ENDED', 'DISABLED', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT';

-- 原有时间状态统一为已发布，有效期字段保留不变。
UPDATE `coupon`
SET `status` = 'PUBLISHED'
WHERE `status` IN ('NOT_STARTED', 'ACTIVE', 'ENDED');

ALTER TABLE `coupon`
  MODIFY `status` ENUM('DRAFT', 'PUBLISHED', 'DISABLED') NOT NULL DEFAULT 'DRAFT';

-- 扩展现有账户及流水，保留原始余额和流水。
ALTER TABLE `user` ADD COLUMN `point_debt` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `point_record`
  MODIFY COLUMN `description` VARCHAR(300) NULL,
  ADD COLUMN `flow_type` VARCHAR(32) NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN `balance_before` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `debt_before` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `debt_after` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `earned` INTEGER NULL,
  ADD COLUMN `offset` INTEGER NULL,
  ADD COLUMN `order_id` INTEGER NULL,
  ADD COLUMN `order_no` VARCHAR(100) NULL,
  ADD COLUMN `refund_no` VARCHAR(100) NULL,
  ADD COLUMN `operator_id` INTEGER NULL,
  ADD COLUMN `request_id` VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ADD COLUMN `amount` INTEGER NULL,
  ADD COLUMN `source` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `point_record_request_id_key` (`request_id`),
  ADD INDEX `point_record_created_at_id_idx` (`created_at`, `id`),
  ADD INDEX `point_record_flow_type_created_at_idx` (`flow_type`, `created_at`);

-- 仅将已知来源的订单流水映射到明确业务类型，其余保留历史类型，避免编造来源。
UPDATE `point_record` SET
  `balance_before` = `balance` - `change`,
  `flow_type` = CASE
    WHEN `business_type` = 'PRODUCT_ORDER' AND `type` = 'EXPENSE'
      AND `description` = '待支付订单占用积分' THEN 'ORDER_DEDUCT'
    WHEN `business_type` = 'PRODUCT_ORDER' AND `type` = 'INCOME'
      AND `description` = '取消待支付订单返还积分' THEN 'CANCEL_RETURN'
    WHEN `type` = 'MANUAL' AND `change` > 0 THEN 'MANUAL_INCREASE'
    WHEN `type` = 'MANUAL' AND `change` < 0 THEN 'MANUAL_DECREASE'
    ELSE CONCAT('LEGACY_', `type`)
  END,
  `order_no` = CASE WHEN `business_type` = 'PRODUCT_ORDER' THEN `related_no` ELSE NULL END,
  `amount` = ABS(`change`),
  `source` = '历史记录';

UPDATE `point_record` SET `earned` = `change`, `offset` = 0
WHERE `flow_type` IN ('LEGACY_INCOME', 'MANUAL_INCREASE') AND `change` > 0;

UPDATE `point_record` p JOIN `product_order` o ON p.`order_no` = o.`order_no`
SET p.`order_id` = o.`id`;

-- 旧累计字段未被订单逻辑维护，按已有流水统一回填；无流水时累计为零，余额不变。
UPDATE `user` u LEFT JOIN (
  SELECT `user_id`,
    SUM(COALESCE(`earned`, 0)) AS earned,
    GREATEST(0, SUM(CASE
      WHEN `flow_type` IN ('ORDER_DEDUCT', 'MANUAL_DECREASE', 'LEGACY_EXPENSE') THEN ABS(`change`)
      WHEN `flow_type` = 'CANCEL_RETURN' THEN -ABS(`change`)
      ELSE 0 END)) AS used
  FROM `point_record` GROUP BY `user_id`
) p ON p.`user_id` = u.`id`
SET u.`total_points_earned` = COALESCE(p.earned, 0), u.`total_points_used` = COALESCE(p.used, 0);

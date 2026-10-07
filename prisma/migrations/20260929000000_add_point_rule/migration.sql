-- 当前全局积分规则；不写入示例比例，由管理员首次保存时明确配置。
-- 业务层统一使用 id = 1，修改时递增 version；订单需单独保存规则快照。
CREATE TABLE `point_rule` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `reward_enabled` BOOLEAN NOT NULL DEFAULT false,
    `reward_yuan` DECIMAL(10, 2) NOT NULL,
    `reward_points` INTEGER NOT NULL,
    `deduct_enabled` BOOLEAN NOT NULL DEFAULT false,
    `deduct_points` INTEGER NOT NULL,
    `deduct_yuan` DECIMAL(10, 2) NOT NULL,
    `limit` INTEGER NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `updated_by_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `point_rule_updated_by_id_idx` (`updated_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `point_rule` ADD CONSTRAINT `point_rule_updated_by_id_fkey`
    FOREIGN KEY (`updated_by_id`) REFERENCES `admin`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

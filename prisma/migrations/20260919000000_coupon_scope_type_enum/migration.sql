-- 将优惠券适用范围限制为全部、装修、商品。
ALTER TABLE `coupon`
  MODIFY `scope_type` ENUM('ALL', 'RENOVATION', 'PRODUCT') NOT NULL DEFAULT 'ALL';

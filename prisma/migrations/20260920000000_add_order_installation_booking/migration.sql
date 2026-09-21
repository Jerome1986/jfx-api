-- Keep legacy orders without a booking nullable; do not infer dates from remarks.
ALTER TABLE `product_order`
  ADD COLUMN `appointment_date` DATE NULL,
  ADD COLUMN `time_slot` VARCHAR(11) NULL;

import { Module } from '@nestjs/common';
import { UserCouponService } from './user-coupon.service';
import { UserCouponController } from './user-coupon.controller';

@Module({
  controllers: [UserCouponController],
  providers: [UserCouponService],
})
export class UserCouponModule {}

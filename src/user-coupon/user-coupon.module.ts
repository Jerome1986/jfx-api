import { Module } from '@nestjs/common';
import { UserCouponService } from './user-coupon.service';
import { UserCouponController } from './user-coupon.controller';
import { UserCouponRepository } from './user-coupon.repository';
import { CouponRepository } from 'src/coupon/coupon.repository';
import { UserRepository } from 'src/user/user.repository';

@Module({
  controllers: [UserCouponController],
  providers: [UserCouponService, UserCouponRepository, CouponRepository, UserRepository],
})
export class UserCouponModule { }

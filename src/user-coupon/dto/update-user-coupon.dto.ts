import { PartialType } from '@nestjs/mapped-types';
import { CreateUserCouponDto } from './create-user-coupon.dto';

export class UpdateUserCouponDto extends PartialType(CreateUserCouponDto) {}

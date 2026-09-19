import { Injectable } from '@nestjs/common';
import { CreateUserCouponDto } from './dto/create-user-coupon.dto';
import { UpdateUserCouponDto } from './dto/update-user-coupon.dto';

@Injectable()
export class UserCouponService {
  create(createUserCouponDto: CreateUserCouponDto) {
    return 'This action adds a new userCoupon';
  }

  findAll() {
    return `This action returns all userCoupon`;
  }

  findOne(id: number) {
    return `This action returns a #${id} userCoupon`;
  }

  update(id: number, updateUserCouponDto: UpdateUserCouponDto) {
    return `This action updates a #${id} userCoupon`;
  }

  remove(id: number) {
    return `This action removes a #${id} userCoupon`;
  }
}

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserCouponDto } from './dto/create-user-coupon.dto';
import { UpdateUserCouponDto } from './dto/update-user-coupon.dto';
import { UserCouponRepository } from './user-coupon.repository';
import { CouponRepository } from '../coupon/coupon.repository';
import { UserRepository } from 'src/user/user.repository';

@Injectable()
export class UserCouponService {
  constructor(
    private userCouponRepo: UserCouponRepository,
    private couponRepo: CouponRepository,
    private userRepo: UserRepository
  ) { }

  // 给指定用户发放优惠券
  async sendCouponByUser(createUserCouponDto: CreateUserCouponDto) {
    const { userId, couponId } = createUserCouponDto
    // 1.校验用户是否存在/禁用
    const user = await this.userRepo.findById(userId)
    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    if (!user.status) {
      throw new ForbiddenException('用户已被禁用，不能发放优惠券')
    }

    // 2.获取优惠券模板的过期时间
    const coupon = await this.couponRepo.findOne(couponId)
    if (!coupon) throw new NotFoundException('优惠券模板不存在')
    const expiresAt = coupon.validTo

    // 3.发放优惠券
    return this.userCouponRepo.sendCouponByUser(createUserCouponDto, expiresAt)
  }

  // 查找发放记录
  findAll() {
    return this.userCouponRepo.findAll()
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

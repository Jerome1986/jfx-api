import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
    private userRepo: UserRepository,
    private prisma: PrismaService
  ) { }

  // 在同一事务中发放优惠券并增加已发行数量。
  async sendCouponByUser(dto: CreateUserCouponDto) {
    const { userId, couponId } = dto
    try {
      return await this.prisma.$transaction(async tx => {
        // 1. 校验领取用户存在且未被禁用。
        const user = await this.userRepo.findById(userId, tx)
        if (!user) throw new NotFoundException('用户不存在')
        if (!user.status) throw new ForbiddenException('用户已被禁用，不能发放优惠券')
        // 2. 校验优惠券模板存在且仍有发行额度。
        const coupon = await this.couponRepo.findOne(couponId, tx)
        if (!coupon) throw new NotFoundException('优惠券模板不存在')
        if (coupon.issuedQuantity >= coupon.totalQuantity) throw new ConflictException('优惠券发行数量已达上限')
        // 3. 原子增加已发行数量，防止并发超发；发行总量保持不变。
        const changed = await this.couponRepo.incrementIssuedQuantity(couponId, coupon.totalQuantity, tx)
        if (changed.count !== 1) throw new ConflictException('优惠券发行额度已变化，请刷新后重试')
        // 4. 创建用户优惠券，失败时已发行数量的增加一并回滚。
        return this.userCouponRepo.sendCouponByUser(dto, coupon.validTo, tx)
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('优惠券数据已变化，请重试发放')
      }
      throw error
    }
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

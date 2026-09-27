import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { CouponRepository } from './coupon.repository';
import { QueryCouponDto } from './dto/query-coupon.dto';

@Injectable()
export class CouponService {
  constructor(private couponRepo: CouponRepository) { }
  // 新建优惠券模板
  create(createCouponDto: CreateCouponDto) {
    return this.couponRepo.create(createCouponDto)
  }

  // 获取优惠券列表
  async findAll(query: QueryCouponDto = {}) {
    const pageNum = query.pageNum ?? 1
    const pageSize = query.pageSize ?? 10
    const [list, total] = await this.couponRepo.findPage({
      ...query,
      pageNum,
      pageSize,
    })
    return {
      list,
      total,
      pageNum,
      pageSize,
      totalPage: Math.ceil(total / pageSize),
    }
  }

  // 获取优惠券详情
  findOne(id: number) {
    return this.couponRepo.findOne(id)
  }

  // 更新优惠券
  update(id: number, updateCouponDto: UpdateCouponDto) {
    return this.couponRepo.update(id, updateCouponDto)
  }

  // 删除优惠券
  async remove(id: number) {
    if (!Number.isInteger(id) || id < 1 || id > 2147483647) {
      throw new BadRequestException('优惠券模板ID必须是1至2147483647之间的整数')
    }
    try {
      return await this.couponRepo.remove(id)
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          const coupon = await this.couponRepo.findOne(id)
          if (!coupon) throw new NotFoundException('优惠券模板不存在')
          throw new ConflictException('优惠券已发放，不能删除，请停用模板')
        }
        if (error.code === 'P2003') {
          throw new ConflictException('优惠券存在关联记录，不能删除，请停用模板')
        }
      }
      throw error
    }
  }
}

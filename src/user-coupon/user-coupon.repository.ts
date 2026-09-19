import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateUserCouponDto } from "./dto/create-user-coupon.dto";

@Injectable()
export class UserCouponRepository {
  constructor(private prisma: PrismaService) { }

  // 给指定用户发放优惠券(过期时间应该由模板里传过来)
  sendCouponByUser(createUserCouponDto: CreateUserCouponDto, expiresAt: Date) {
    return this.prisma.userCoupon.create({
      data: {
        ...createUserCouponDto,
        expiresAt
      }
    })
  }

  // 查找发放记录
  findAll() {
    return this.prisma.userCoupon.findMany()
  }
}
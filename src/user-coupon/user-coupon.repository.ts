import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateUserCouponDto } from "./dto/create-user-coupon.dto";
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class UserCouponRepository {
  constructor(private prisma: PrismaService) { }

  // 给指定用户发放优惠券(过期时间应该由模板里传过来)
  sendCouponByUser(createUserCouponDto: CreateUserCouponDto, expiresAt: Date, tx: Prisma.TransactionClient = this.prisma) {
    return tx.userCoupon.create({
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

  // 根据优惠券ID查询当前优惠券
  findOne(id: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma
    return db.userCoupon.findFirst({
      where: { id },
      include: {
        coupon: {
          select: {
            amount: true,
            threshold: true,
            scopeType: true,
            validFrom: true,
            status: true,
          }
        }
      }
    })
  }
}

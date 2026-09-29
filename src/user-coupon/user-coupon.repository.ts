import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateUserCouponDto } from "./dto/create-user-coupon.dto";
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class UserCouponRepository {
  // 注入 PrismaService，封装当前模块的数据库访问。
  constructor(private prisma: PrismaService) { }

  // 保存用户优惠券发放记录及传入的过期时间，默认使用数据库服务，也可复用事务。
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

  // 根据用户优惠券记录 ID 查询详情及关联模板的金额、门槛、范围和有效状态。
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

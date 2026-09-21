import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCouponDto } from "./dto/create-coupon.dto";
import { QueryCouponDto } from './dto/query-coupon.dto';
import { Prisma } from '../../generated/prisma/client';
import { UpdateCouponDto } from "./dto/update-coupon.dto";

@Injectable()
export class CouponRepository {
  constructor(private readonly prisma: PrismaService) { }

  // 新建优惠券模板
  create(createCouponDto: CreateCouponDto) {
    return this.prisma.coupon.create({
      data: createCouponDto
    })
  }

  // 列表和总数使用相同筛选条件，在同一快照内读取。
  findPage(query: QueryCouponDto & { pageNum: number; pageSize: number }) {
    const keyword = query.keyword?.trim()
    // 转义LIKE通配符，按用户输入的字面内容搜索。
    const contains = keyword?.replace(/[\\%_]/g, '\\$&')
    const where: Prisma.CouponWhereInput = {
      ...(contains ? { name: { contains } } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
    }
    return this.prisma.$transaction(
      [
        this.prisma.coupon.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (query.pageNum - 1) * query.pageSize,
          take: query.pageSize,
        }),
        this.prisma.coupon.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    )
  }

  // 详情
  findOne(id: number, tx: Prisma.TransactionClient = this.prisma) {
    return tx.coupon.findFirst({
      where: { id }
    })
  }

  // 在发行总量内增加已发行数量，返回实际更新的记录数。
  incrementIssuedQuantity(id: number, totalQuantity: number, tx: Prisma.TransactionClient) {
    return tx.coupon.updateMany({
      where: { id, totalQuantity, issuedQuantity: { lt: totalQuantity } },
      data: { issuedQuantity: { increment: 1 } },
    })
  }

  // 更新
  update(id: number, updateCouponDto: UpdateCouponDto) {
    return this.prisma.coupon.update({
      where: { id },
      data: updateCouponDto
    })
  }

  // 在删除语句中校验发放情况，避免检查后发券导致误删。
  remove(id: number) {
    return this.prisma.coupon.delete({
      where: { id, issuedQuantity: 0, userCoupons: { none: {} } },
    })
  }
}

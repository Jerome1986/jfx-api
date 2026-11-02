import { legacyProjectOmit } from './legacy-project-fields';
import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { ProjectStatus } from "./dto/query-user-renovation-project.dto";

@Injectable()
export class RenovationProjectRepository {
  // 注入 PrismaService，封装当前模块的数据库访问。
  constructor(private prisma: PrismaService) { }

  // 创建装修项目及传入的关联数据，返回记录时排除历史兼容字段。
  createRenovationProject(data: Prisma.RenovationProjectUncheckedCreateInput) {
    return this.prisma.renovationProject.create({
      omit: legacyProjectOmit,
      data
    })
  }

  // 获取指定用户装修列表
  async findAllByUser(userId: number, status: ProjectStatus, pageNum: number, pageSize: number) {
    let where: any = {
      userId,
      status: { notIn: ['PENDING_QUOTE'] }
    }
    if (status !== 'ALL') where.status = status

    return await Promise.all([
      this.prisma.renovationProject.findMany({
      omit: legacyProjectOmit,
        where,
        include: { plan: true, quoteItems: { orderBy: [{ sort: 'asc' }, { id: 'asc' }] } },
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.renovationProject.count({ where })
    ])
  }

  // 根据 appointmentId 查询是否有已经创建过的项目
  getProjectByAppointmentId(appointmentId: number) {
    return this.prisma.renovationProject.findFirst({
      omit: legacyProjectOmit,
      where: { appointmentId }
    })
  }

  // 项目详情
  findOne(id: number, userId: number) {
    return this.prisma.renovationProject.findFirst({
      omit: legacyProjectOmit,
      where: { id, userId },
      include: { plan: true, quoteItems: { orderBy: [{ sort: 'asc' }, { id: 'asc' }] } }
    })
  }

  // 金额、核销和状态一起提交，竞争失败会回滚整笔事务。
  confirmProject(id: number, userId: number, project: { updatedAt: Date; quotedAmount: Prisma.Decimal; quoteVersion: number }, userCouponId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date()
      let discount = new Prisma.Decimal(0)
      let snapshot: Prisma.InputJsonObject | undefined
      if (userCouponId !== undefined) {
        const record = await tx.userCoupon.findUnique({ where: { id: userCouponId }, include: { coupon: true } })
        if (!record || record.userId !== userId || record.status !== 'AVAILABLE' || record.orderId !== null || record.projectId !== null)
          throw new BadRequestException('优惠券已使用或不可用')
        const coupon = record.coupon
        if (record.expiresAt <= now || coupon.validFrom > now || coupon.status === 'DRAFT')
          throw new BadRequestException('优惠券已过期或尚未生效')
        if (coupon.scopeType !== 'ALL' && coupon.scopeType !== 'RENOVATION')
          throw new BadRequestException('该优惠券不适用于装修项目')
        if (!coupon.amount.isFinite() || coupon.amount.lte(0) || !coupon.threshold.isFinite() || coupon.threshold.lt(0))
          throw new BadRequestException('优惠券金额异常')
        if (project.quotedAmount.lte(0) || project.quotedAmount.lt(coupon.threshold))
          throw new BadRequestException('项目报价未达到优惠券使用门槛')
        discount = Prisma.Decimal.min(coupon.amount, project.quotedAmount)
        snapshot = { userCouponId, name: coupon.name, amount: coupon.amount.toFixed(2), threshold: coupon.threshold.toFixed(2) }
      }
      const result = await tx.renovationProject.update({
        omit: legacyProjectOmit,
        where: { id, userId, status: 'PENDING_CONFIRM', quoteVersion: project.quoteVersion, updatedAt: project.updatedAt, quotedAmount: project.quotedAmount },
        data: {
          status: 'IN_SERVICE', contractAmount: project.quotedAmount.minus(discount),
          couponDiscount: discount, couponSnapshot: snapshot ?? Prisma.DbNull, couponReturnedAt: null,
          quoteConfirmedAt: now, progress: '客户已确认报价，开始服务',
          progresses: { create: { status: 'IN_SERVICE', content: '客户已确认报价，开始服务', createdBy: `user:${userId}` } },
        },
      })
      if (userCouponId !== undefined) {
        const claimed = await tx.userCoupon.updateMany({
          where: { id: userCouponId, userId, status: 'AVAILABLE', orderId: null, projectId: null, expiresAt: { gt: now } },
          data: { projectId: id, status: 'USED', usedAt: now },
        })
        if (claimed.count !== 1) throw new ConflictException('优惠券状态已变化，请重新选择')
      }
      return result
    })
  }
}

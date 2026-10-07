import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import type { PointRecord } from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AdjustPointDto } from './dto/adjust-point.dto'
import { QueryPointAccountsDto, QueryPointFlowsDto } from './dto/query-point.dto'
import { writePointChange } from './point-ledger'

const accountSelect = {
  id: true, nickname: true, mobile: true, points: true,
  totalPointsEarned: true, totalPointsUsed: true, pointDebt: true,
} satisfies Prisma.UserSelect

@Injectable()
export class PointRepository {
  constructor(private readonly prisma: PrismaService) {}

  // 用户 ID 精确匹配；昵称、手机号模糊匹配。
  private userFilter(keyword?: string): Prisma.UserWhereInput {
    if (!keyword) return {}
    const id = /^\d+$/.test(keyword) ? Number(keyword) : 0
    return { OR: [
      ...(Number.isInteger(id) && id > 0 && id <= 2147483647 ? [{ id }] : []),
      { nickname: { contains: keyword } }, { mobile: { contains: keyword } },
    ] }
  }

  accounts(query: QueryPointAccountsDto) {
    const where: Prisma.UserWhereInput = {
      ...this.userFilter(query.keyword),
      ...(query.hasDebt === undefined ? {} : { pointDebt: query.hasDebt ? { gt: 0 } : 0 }),
    }
    return this.prisma.$transaction([
      this.prisma.user.findMany({
        where, select: accountSelect, orderBy: { id: 'desc' },
        skip: (query.page - 1) * query.pageSize, take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
  }

  account(userId: number) {
    return this.prisma.user.findUnique({ where: { id: userId }, select: accountSelect })
  }

  flows(query: QueryPointFlowsDto) {
    const where: Prisma.PointRecordWhereInput = {
      userId: query.userId,
      ...(query.keyword ? { user: this.userFilter(query.keyword) } : {}),
      ...(query.orderNo ? { orderNo: { contains: query.orderNo } } : {}),
      ...(query.type ? { flowType: query.type } : {}),
      ...(query.startDate || query.endDate ? { createdAt: {
        ...(query.startDate ? { gte: new Date(query.startDate + 'T00:00:00+08:00') } : {}),
        ...(query.endDate ? { lt: new Date(new Date(query.endDate + 'T00:00:00+08:00').getTime() + 86400000) } : {}),
      } } : {}),
    }
    return this.prisma.$transaction([
      this.prisma.pointRecord.findMany({
        where, include: { user: { select: { nickname: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize, take: query.pageSize,
      }),
      this.prisma.pointRecord.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
  }

  flow(id: number) {
    return this.prisma.pointRecord.findUnique({
      where: { id }, include: { user: { select: { nickname: true } } },
    })
  }

  // 历史流水和下单时写入的流水通过订单号补齐跳转所需 ID，批量查询避免逐条访问。
  orders(orderNos: string[]) {
    return this.prisma.productOrder.findMany({
      where: { orderNo: { in: orderNos } }, select: { id: true, orderNo: true },
    })
  }

  private sameRequest(record: PointRecord, userId: number, dto: AdjustPointDto, adminId: number) {
    const flowType = dto.direction === 'increase' ? 'MANUAL_INCREASE' : 'MANUAL_DECREASE'
    if (record.userId !== userId || record.operatorId !== adminId || record.flowType !== flowType
      || record.amount !== dto.amount || record.description !== dto.reason) {
      throw new ConflictException('requestId已用于其他积分调整，请勿修改重试参数')
    }
    return record
  }

  async adjust(userId: number, dto: AdjustPointDto, adminId: number) {
    try {
      return await this.prisma.$transaction(async tx => {
        // 同一用户的调整串行执行；ReadCommitted 确保等待锁后能读到已提交的幂等记录。
        const users = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM user WHERE id = ${userId} FOR UPDATE`
        if (!users.length) throw new NotFoundException('用户不存在')
        const existing = await tx.pointRecord.findUnique({ where: { requestId: dto.requestId } })
        if (existing) return this.sameRequest(existing, userId, dto, adminId)
        const admin = await tx.admin.findUnique({ where: { id: adminId }, select: { username: true, status: true } })
        if (!admin?.status) throw new ForbiddenException('管理员账号不存在或已禁用')
        return writePointChange(tx, {
          userId, amount: dto.amount,
          flowType: dto.direction === 'increase' ? 'MANUAL_INCREASE' : 'MANUAL_DECREASE',
          reason: dto.reason, requestId: dto.requestId,
          operatorId: adminId, operatorName: admin.username,
        })
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        const lockConflict = error.code === 'P2010' && ['1205', '1213'].includes(String(error.meta?.code))
        if (error.code === 'P2002' || error.code === 'P2034' || error.code === 'P2028' || lockConflict) {
          // 跨账户复用同一个 requestId 时，唯一索引使失败事务整体回滚。
          const existing = await this.prisma.pointRecord.findUnique({ where: { requestId: dto.requestId } })
          if (existing) return this.sameRequest(existing, userId, dto, adminId)
          throw new ConflictException('积分账户发生并发冲突，请使用相同requestId重试')
        }
      }
      throw error
    }
  }
}

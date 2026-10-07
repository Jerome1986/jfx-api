import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { PointRecord } from '../../generated/prisma/client'
import { AdjustPointDto } from './dto/adjust-point.dto'
import { QueryPointAccountsDto, QueryPointFlowsDto } from './dto/query-point.dto'
import { PointRepository } from './point.repository'

@Injectable()
export class PointService {
  constructor(private readonly pointRepository: PointRepository) {}

  private toAccount(user: {
    id: number; nickname: string | null; mobile: string | null; points: number
    totalPointsEarned: number; totalPointsUsed: number; pointDebt: number
  }) {
    return {
      userId: user.id, nickname: user.nickname, phone: user.mobile,
      balance: user.points, earned: user.totalPointsEarned,
      used: user.totalPointsUsed, debt: user.pointDebt,
    }
  }

  async accounts(query: QueryPointAccountsDto) {
    const [users, total] = await this.pointRepository.accounts(query)
    return { list: users.map(user => this.toAccount(user)), total, page: query.page, pageSize: query.pageSize }
  }

  async account(userId: number) {
    const user = await this.pointRepository.account(userId)
    if (!user) throw new NotFoundException('用户不存在')
    return this.toAccount(user)
  }

  async adjust(userId: number, dto: AdjustPointDto, adminId: number) {
    const record = await this.pointRepository.adjust(userId, dto, adminId)
    return {
      flowId: 'PF' + record.id, userId: record.userId, amount: record.amount,
      offset: record.offset ?? 0,
      balanceBefore: record.balanceBefore, balanceAfter: record.balance,
      debtBefore: record.debtBefore, debtAfter: record.debtAfter,
    }
  }

  private toFlow(record: PointRecord & { user: { nickname: string | null } }, orders: Map<string, number>) {
    return {
      id: 'PF' + record.id, userId: record.userId, nickname: record.user.nickname,
      type: record.flowType, before: record.balanceBefore, after: record.balance,
      debtBefore: record.debtBefore, debtAfter: record.debtAfter,
      orderId: record.orderId ?? (record.orderNo ? orders.get(record.orderNo) ?? null : null),
      orderNo: record.orderNo, occurredAt: record.createdAt,
      source: record.source ?? '历史记录',
    }
  }

  private async orderMap(records: PointRecord[]) {
    const orderNos = [...new Set(records.filter(record => record.orderNo && !record.orderId).map(record => record.orderNo!))]
    const orders = orderNos.length ? await this.pointRepository.orders(orderNos) : []
    return new Map(orders.map(order => [order.orderNo, order.id]))
  }

  async flows(query: QueryPointFlowsDto) {
    if (query.startDate && query.endDate && query.startDate > query.endDate) {
      throw new BadRequestException('开始日期不能晚于结束日期')
    }
    const [records, total] = await this.pointRepository.flows(query)
    const orders = await this.orderMap(records)
    return { list: records.map(record => this.toFlow(record, orders)), total, page: query.page, pageSize: query.pageSize }
  }

  async flow(id: string) {
    // 流水 ID 直接使用 PF + 数据库主键，唯一且无需额外编号表。
    if (!/^PF[1-9]\d*$/.test(id) || Number(id.slice(2)) > 2147483647) {
      throw new BadRequestException('积分流水ID格式错误')
    }
    const record = await this.pointRepository.flow(Number(id.slice(2)))
    if (!record) throw new NotFoundException('积分流水不存在')
    return {
      ...this.toFlow(record, await this.orderMap([record])),
      refundNo: record.refundNo, reason: record.description,
      operatorId: record.operatorId, operatorName: record.operator,
      earned: record.earned, offset: record.offset,
    }
  }
}

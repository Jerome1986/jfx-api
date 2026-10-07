import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import type { Prisma } from '../../generated/prisma/client'

type FlowType = 'ORDER_REWARD' | 'ORDER_DEDUCT' | 'CANCEL_RETURN' | 'REFUND_RETURN'
  | 'REFUND_RECOVER' | 'MANUAL_INCREASE' | 'MANUAL_DECREASE'

export interface PointChange {
  userId: number
  flowType: FlowType
  amount: number
  reason: string
  orderId?: number
  orderNo?: string
  refundNo?: string
  operatorId?: number
  operatorName?: string
  requestId?: string
  requireEnabled?: boolean
}

interface PointAccount {
  id: number
  points: number
  pointDebt: number
  totalPointsEarned: number
  totalPointsUsed: number
  status: boolean
}

// 已持有用户行锁后计算变动；账户更新和流水必须由调用方放在同一事务内。
export function calculatePointChange(account: PointAccount, flowType: FlowType, amount: number) {
  if (!Number.isInteger(amount) || amount <= 0 || amount > 2147483647) {
    throw new BadRequestException('积分数量不合法')
  }
  const isEarn = flowType === 'ORDER_REWARD' || flowType === 'MANUAL_INCREASE'
  const isSpend = flowType === 'ORDER_DEDUCT' || flowType === 'MANUAL_DECREASE'
  const isReturn = flowType === 'CANCEL_RETURN' || flowType === 'REFUND_RETURN'
  let balance = account.points
  let debt = account.pointDebt
  let offset = 0
  if (isSpend) {
    if (balance < amount) throw new BadRequestException('可用积分不足，无法扣减')
    balance -= amount
  } else if (flowType === 'REFUND_RECOVER') {
    const recovered = Math.min(balance, amount)
    balance -= recovered
    debt += amount - recovered
  } else {
    offset = Math.min(debt, amount)
    debt -= offset
    balance += amount - offset
  }
  const totalPointsEarned = account.totalPointsEarned + (isEarn ? amount : 0)
  const totalPointsUsed = Math.max(0, account.totalPointsUsed + (isSpend ? amount : isReturn ? -amount : 0))
  if ([balance, debt, totalPointsEarned, totalPointsUsed].some(value => value > 2147483647 || value < 0)) {
    throw new BadRequestException('积分账户数值超出允许范围')
  }
  return { balance, debt, totalPointsEarned, totalPointsUsed, earned: isEarn ? amount : null, offset: isEarn ? offset : null }
}

export async function writePointChange(tx: Prisma.TransactionClient, input: PointChange) {
  // 锁定单个账户，串行处理人工调整、订单扣减和取消返还，读取最新余额。
  const rows = await tx.$queryRaw<PointAccount[]>`
    SELECT id, points, point_debt AS pointDebt, total_points_earned AS totalPointsEarned,
           total_points_used AS totalPointsUsed, status
    FROM user WHERE id = ${input.userId} FOR UPDATE
  `
  const account = rows[0]
  if (!account) throw new NotFoundException('用户不存在')
  if (input.requireEnabled && !account.status) throw new ForbiddenException('账号已被禁用')
  const result = calculatePointChange(account, input.flowType, input.amount)
  await tx.user.update({
    where: { id: input.userId },
    data: {
      points: result.balance, pointDebt: result.debt,
      totalPointsEarned: result.totalPointsEarned, totalPointsUsed: result.totalPointsUsed,
    },
  })
  return tx.pointRecord.create({
    data: {
      userId: input.userId,
      type: input.flowType.startsWith('MANUAL_') ? 'MANUAL'
        : ['ORDER_DEDUCT', 'REFUND_RECOVER'].includes(input.flowType) ? 'EXPENSE' : 'INCOME',
      flowType: input.flowType,
      change: result.balance - account.points,
      balanceBefore: account.points, balance: result.balance,
      debtBefore: account.pointDebt, debtAfter: result.debt,
      earned: result.earned, offset: result.offset,
      amount: input.amount,
      description: input.reason,
      businessType: input.orderNo ? 'PRODUCT_ORDER' : 'MANUAL',
      relatedNo: input.orderNo,
      orderId: input.orderId, orderNo: input.orderNo, refundNo: input.refundNo,
      operatorId: input.operatorId, operator: input.operatorName,
      requestId: input.requestId,
      source: input.operatorId ? '管理员操作' : '系统自动操作',
    },
  })
}

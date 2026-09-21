import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { NotifyRepository } from './notify.repository'
import type { PrismaService } from '../prisma/prisma.service'
import type { WechatPaySuccessNotify } from './types/wechat-pay-success-notify'

jest.mock('../../generated/prisma/client', () => ({
  Prisma: {
    Decimal: jest.requireActual('@prisma/client/runtime/client').Decimal,
    TransactionIsolationLevel: { ReadCommitted: 'ReadCommitted' },
  },
}))
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }))

describe('商品支付回调入账', () => {
  const result: WechatPaySuccessNotify = {
    mchid: 'merchant', appid: 'app', out_trade_no: 'order1', transaction_id: 'wx1',
    trade_type: 'JSAPI', trade_state: 'SUCCESS', trade_state_desc: '支付成功', bank_type: 'OTHERS',
    success_time: '2026-09-20T10:31:24+08:00', payer: { openid: 'user1' },
    amount: { total: 100, payer_total: 100, currency: 'CNY', payer_currency: 'CNY' },
  }
  const tx = {
    productOrder: { findUnique: jest.fn(), updateMany: jest.fn() },
    userCoupon: { updateMany: jest.fn() }, user: { update: jest.fn() },
    installationOrder: { create: jest.fn() },
  }
  const prisma = { $transaction: jest.fn(async callback => callback(tx)) }
  const repo = new NotifyRepository(prisma as unknown as PrismaService)
  const makeOrder = () => ({
    appointmentDate: new Date('2026-09-25T00:00:00Z'), timeSlot: '09:00-12:00',
    id: 1, orderNo: 'order1', userId: 2, payableAmount: new Prisma.Decimal(1),
    couponDiscount: new Prisma.Decimal(1), pointsUsed: 10,
    status: 'PENDING_PAYMENT', paymentStatus: 'UNPAID', paymentNo: null, paidAt: null,
    userCoupon: { id: 3 }, contactName: '测试', contactPhone: '123', serviceAddress: '测试地址',
  })
  beforeEach(() => {
    jest.clearAllMocks()
    tx.productOrder.findUnique.mockReset().mockResolvedValue(makeOrder())
    tx.productOrder.updateMany.mockReset().mockResolvedValue({ count: 1 })
    tx.userCoupon.updateMany.mockReset().mockResolvedValue({ count: 1 })
    tx.installationOrder.create.mockReset().mockResolvedValue({ id: 1 })
  })
  it('首次支付核销券、累计积分并创建安装单，不再扣可用积分', async () => {
    await repo.proNotify(result)
    expect(tx.productOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 1, status: 'PENDING_PAYMENT', paymentStatus: 'UNPAID', paymentNo: null },
      data: expect.objectContaining({ paymentNo: 'wx1', paymentStatus: 'PAID', status: 'PENDING_INSTALLATION' }),
    }))
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { totalPointsUsed: { increment: 10 } } })
    expect(tx.userCoupon.updateMany).toHaveBeenCalledTimes(1)
    expect(tx.installationOrder.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      appointmentDate: new Date('2026-09-25T00:00:00Z'), timeSlot: '09:00-12:00', status: 'PENDING_ASSIGNMENT',
    }) })
  })
  it.each(['PAID', 'REFUNDING', 'REFUNDED'])('已入账的重复通知不改变后续状态 %s', async paymentStatus => {
    tx.productOrder.findUnique.mockResolvedValue({ ...makeOrder(), paymentNo: 'wx1', paidAt: new Date(), paymentStatus })
    await repo.proNotify(result)
    expect(tx.productOrder.updateMany).not.toHaveBeenCalled()
    expect(tx.user.update).not.toHaveBeenCalled()
    expect(tx.installationOrder.create).not.toHaveBeenCalled()
  })
  it('并发条件更新失败后确认相同流水，不重复核销', async () => {
    tx.productOrder.updateMany.mockResolvedValue({ count: 0 })
    tx.productOrder.findUnique.mockResolvedValueOnce(makeOrder()).mockResolvedValueOnce({
      ...makeOrder(), paymentNo: 'wx1', paidAt: new Date(), paymentStatus: 'PAID',
    })
    await repo.proNotify(result)
    expect(tx.userCoupon.updateMany).not.toHaveBeenCalled()
    expect(tx.installationOrder.create).not.toHaveBeenCalled()
  })
  it('不同流水或已取消订单不能覆盖', async () => {
    tx.productOrder.findUnique.mockResolvedValue({ ...makeOrder(), status: 'CANCELED' })
    await expect(repo.proNotify(result)).rejects.toBeInstanceOf(ConflictException)
    expect(tx.productOrder.updateMany).not.toHaveBeenCalled()
  })
  it('金额不一致时不写入', async () => {
    await expect(repo.proNotify({ ...result, amount: { ...result.amount, total: 1 } })).rejects.toBeInstanceOf(BadRequestException)
    expect(tx.productOrder.updateMany).not.toHaveBeenCalled()
  })
  it('订单不存在时报错', async () => {
    tx.productOrder.findUnique.mockResolvedValue(null)
    await expect(repo.proNotify(result)).rejects.toBeInstanceOf(NotFoundException)
  })
  it('优惠券核销失败向事务抛错，中止后续操作', async () => {
    tx.userCoupon.updateMany.mockResolvedValue({ count: 0 })
    await expect(repo.proNotify(result)).rejects.toBeInstanceOf(ConflictException)
    expect(tx.user.update).not.toHaveBeenCalled()
    expect(tx.installationOrder.create).not.toHaveBeenCalled()
  })
  it('安装单创建失败必须抛出，不能确认回调成功', async () => {
    tx.installationOrder.create.mockRejectedValue(new Error('database unavailable'))
    await expect(repo.proNotify(result)).rejects.toThrow('database unavailable')
  })
  it('legacy orders do not receive an invented appointment', async () => {
    tx.productOrder.findUnique.mockResolvedValue({ ...makeOrder(), appointmentDate: null, timeSlot: null })
    await repo.proNotify(result)
    expect(tx.installationOrder.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      appointmentDate: null, timeSlot: null, status: 'PENDING_APPOINTMENT',
    }) })
  })
})

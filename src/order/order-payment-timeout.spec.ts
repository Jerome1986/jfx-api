import { ConflictException, Logger, ServiceUnavailableException } from '@nestjs/common'
import { OrderService } from './order.service'
import { OrderRepository } from './order.repository'
import { PAYMENT_TIMEOUT_MS, PAYMENT_TIMEOUT_REASON, paymentExpiresAt, paymentExpired, withPaymentDeadline } from './order-payment-timeout'

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }))
jest.mock('./order-preparation.service', () => ({ OrderPreparationService: class {} }))
jest.mock('../payment/payment.service', () => ({ PaymentService: class {} }))
jest.mock('../../generated/prisma/client', () => ({ Prisma: { TransactionIsolationLevel: { ReadCommitted: 'ReadCommitted' } } }))

describe('待付款 30 分钟超时关闭', () => {
  const now = new Date('2026-09-28T04:00:00Z')
  const makeOrder = () => ({ id: 1, userId: 7, orderNo: 'order1', createdAt: new Date(now.getTime() - PAYMENT_TIMEOUT_MS), status: 'PENDING_PAYMENT', paymentStatus: 'UNPAID', paymentNo: null, paidAt: null, pointsUsed: 10, items: [{ productId: 2, quantity: 3 }], user: { status: true, openid: 'openid' } })
  let order: ReturnType<typeof makeOrder>, repo: any, payment: any, service: OrderService
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now)
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})
    order = makeOrder()
    repo = {
      findExpiredPayments: jest.fn().mockResolvedValue([{ id: 1 }]),
      findForCancellation: jest.fn(async () => ({ ...order })),
      markCanceled: jest.fn(async () => { order.status = 'CANCELED'; order.paymentStatus = 'CLOSED'; return { count: 1 } }),
      restoreStock: jest.fn(), restorePoints: jest.fn(), releaseCoupon: jest.fn(),
      findForPayment: jest.fn(async () => order),
    }
    payment = { closeOrder: jest.fn(), wxPay: jest.fn() }
    service = new OrderService(repo, {} as never, payment, { $transaction: jest.fn(fn => fn({})) } as never)
  })
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })

  it('30 分钟边界到期，截止时间不因重试改变', () => {
    expect(paymentExpired(order.createdAt, new Date(now.getTime() - 1))).toBe(false)
    expect(paymentExpired(order.createdAt, now)).toBe(true)
    expect(paymentExpiresAt(order.createdAt)).toEqual(now)
    expect(withPaymentDeadline(order).paymentExpired).toBe(true)
  })
  it('先关微信订单再一次性返还库存、积分和券，记录超时原因', async () => {
    await service.closeExpiredPayments()
    expect(payment.closeOrder).toHaveBeenCalledWith('order1')
    expect(payment.closeOrder.mock.invocationCallOrder[0]).toBeLessThan(repo.markCanceled.mock.invocationCallOrder[0])
    expect(repo.markCanceled).toHaveBeenCalledWith({ id: 1 }, {}, PAYMENT_TIMEOUT_REASON)
    expect(repo.restoreStock).toHaveBeenCalledWith(2, 3, 'order1', 'system:payment-timeout', {})
    expect(repo.restorePoints).toHaveBeenCalledWith(7, 10, 'order1', {})
    expect(repo.releaseCoupon).toHaveBeenCalledWith(1, 7, {})
    await service.closeExpiredPayments()
    expect(repo.restoreStock).toHaveBeenCalledTimes(1)
    expect(repo.restorePoints).toHaveBeenCalledTimes(1)
    expect(repo.releaseCoupon).toHaveBeenCalledTimes(1)
  })
  it('未到期订单不关闭', async () => {
    order.createdAt = new Date(now.getTime() - PAYMENT_TIMEOUT_MS + 1)
    await service.closeExpiredPayments()
    expect(payment.closeOrder).not.toHaveBeenCalled()
    expect(repo.markCanceled).not.toHaveBeenCalled()
  })
  it.each([new ConflictException('已支付'), new ServiceUnavailableException('关单失败')])('微信未确认关单时不释放，后续扫描可以重试', async error => {
    payment.closeOrder.mockRejectedValueOnce(error)
    await service.closeExpiredPayments()
    expect(repo.markCanceled).not.toHaveBeenCalled()
    expect(repo.restorePoints).not.toHaveBeenCalled()
    await service.closeExpiredPayments()
    expect(repo.markCanceled).toHaveBeenCalledTimes(1)
  })
  it('关单期间支付回调已先入账，不能返还资源', async () => {
    payment.closeOrder.mockImplementation(async () => { order.status = 'PENDING_INSTALLATION'; order.paymentStatus = 'PAID' })
    await service.closeExpiredPayments()
    expect(repo.markCanceled).not.toHaveBeenCalled()
    expect(repo.restoreStock).not.toHaveBeenCalled()
  })
  it('并发任务更新未命中不会二次释放资源', async () => {
    repo.markCanceled.mockImplementation(async () => { order.status = 'CANCELED'; order.paymentStatus = 'CLOSED'; return { count: 0 } })
    await service.closeExpiredPayments()
    expect(repo.restoreStock).not.toHaveBeenCalled()
    expect(repo.releaseCoupon).not.toHaveBeenCalled()
  })
  it('失败订单不阻塞下一条，分页按 ID 推进', async () => {
    repo.findExpiredPayments.mockResolvedValueOnce(Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }))).mockResolvedValueOnce([])
    payment.closeOrder.mockRejectedValueOnce(new Error('offline'))
    await service.closeExpiredPayments()
    expect(repo.findExpiredPayments).toHaveBeenNthCalledWith(2, new Date(now.getTime() - PAYMENT_TIMEOUT_MS), 100, 100)
    expect(repo.markCanceled).toHaveBeenCalled()
  })
  it('到期后获取支付参数直接拒绝，不调用微信', async () => {
    await expect(service.pay(1, { userId: 7, type: 'user' })).rejects.toThrow('订单已超时')
    expect(payment.wxPay).not.toHaveBeenCalled()
  })
  it('扫描仅查询到期、未支付、无支付流水订单', async () => {
    const findMany = jest.fn().mockResolvedValue([])
    const repository = new OrderRepository({ productOrder: { findMany } } as any)
    const cutoff = new Date(now.getTime() - PAYMENT_TIMEOUT_MS)
    await repository.findExpiredPayments(cutoff, 5, 100)
    expect(findMany).toHaveBeenCalledWith({ where: { id: { gt: 5 }, createdAt: { lte: cutoff }, status: 'PENDING_PAYMENT', paymentStatus: 'UNPAID', paymentNo: null, paidAt: null }, select: { id: true }, orderBy: { id: 'asc' }, take: 100 })
  })
})

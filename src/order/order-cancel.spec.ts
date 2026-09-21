import { ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import { OrderService } from './order.service'
import { OrderRepository } from './order.repository'

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }))
jest.mock('./order-preparation.service', () => ({ OrderPreparationService: class {} }))
jest.mock('../payment/payment.service', () => ({ PaymentService: class {} }))
jest.mock('../../generated/prisma/client', () => ({
  Prisma: { TransactionIsolationLevel: { ReadCommitted: 'ReadCommitted' } },
}))

const makeOrder = () => ({
  id: 1, userId: 7, orderNo: 'order1', status: 'PENDING_PAYMENT', paymentStatus: 'UNPAID',
  paymentNo: null, paidAt: null, pointsUsed: 10, appointmentDate: null, timeSlot: null, installation: null,
  items: [{ productId: 2, quantity: 2 }, { productId: 2, quantity: 3 }, { productId: null, quantity: 1 }],
})

describe('cancel order service', () => {
  let repo: any, payment: any, service: OrderService
  beforeEach(() => {
    repo = { findForCancellation: jest.fn().mockResolvedValue(makeOrder()), markCanceled: jest.fn().mockResolvedValue({ count: 1 }), restoreStock: jest.fn(), restorePoints: jest.fn(), releaseCoupon: jest.fn() }
    payment = { closeOrder: jest.fn().mockResolvedValue(undefined) }
    service = new OrderService(repo, {} as never, payment, { $transaction: jest.fn(fn => fn({})) } as never)
  })
  it('scopes customer access and closes payment before releasing resources', async () => {
    await service.cancel(1, { userId: 7, type: 'user' })
    expect(repo.findForCancellation).toHaveBeenCalledWith({ id: 1, userId: 7 })
    expect(payment.closeOrder).toHaveBeenCalledWith('order1')
    expect(payment.closeOrder.mock.invocationCallOrder[0]).toBeLessThan(repo.markCanceled.mock.invocationCallOrder[0])
    expect(repo.markCanceled).toHaveBeenCalledWith({ id: 1, userId: 7 }, {})
  })
  it('allows admin access without confusing admin ID with customer ID', async () => {
    await service.cancel(1, { userId: 99, type: 'admin' })
    expect(repo.findForCancellation).toHaveBeenCalledWith({ id: 1 })
  })
  it('does not contact payment for missing or inaccessible orders', async () => {
    repo.findForCancellation.mockResolvedValue(null)
    await expect(service.cancel(1, { userId: 8, type: 'user' })).rejects.toThrow(NotFoundException)
    expect(payment.closeOrder).not.toHaveBeenCalled()
  })
  it.each(['PENDING_INSTALLATION', 'IN_SERVICE', 'COMPLETED', 'REFUNDING', 'REFUNDED'])('rejects %s', async status => {
    repo.findForCancellation.mockResolvedValue({ ...makeOrder(), status })
    await expect(service.cancel(1, { userId: 7, type: 'user' })).rejects.toThrow(ConflictException)
    expect(payment.closeOrder).not.toHaveBeenCalled()
  })
  it('keeps resources when the payment close result is uncertain', async () => {
    payment.closeOrder.mockRejectedValue(new ServiceUnavailableException())
    await expect(service.cancel(1, { userId: 7, type: 'user' })).rejects.toThrow(ServiceUnavailableException)
    expect(repo.markCanceled).not.toHaveBeenCalled()
  })
  it('returns an already canceled order without side effects', async () => {
    repo.findForCancellation.mockResolvedValue({ ...makeOrder(), status: 'CANCELED', paymentStatus: 'CLOSED' })
    await service.cancel(1, { userId: 7, type: 'user' })
    expect(payment.closeOrder).not.toHaveBeenCalled()
    expect(repo.markCanceled).not.toHaveBeenCalled()
  })
})

describe('cancel order resources', () => {
  let tx: any, repo: OrderRepository, prisma: any, service: OrderService
  beforeEach(() => {
    tx = {
      productOrder: {
        findFirst: jest.fn().mockResolvedValueOnce(makeOrder()).mockResolvedValueOnce(makeOrder()).mockResolvedValue({ ...makeOrder(), status: 'CANCELED', paymentStatus: 'CLOSED' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...makeOrder(), status: 'CANCELED', paymentStatus: 'CLOSED' }),
      },
      product: { update: jest.fn().mockResolvedValue({ stock: 15 }) },
      stockLog: { create: jest.fn() },
      user: { update: jest.fn().mockResolvedValue({ points: 110 }) },
      pointRecord: { create: jest.fn() },
      userCoupon: { updateMany: jest.fn() },
    }
    prisma = { productOrder: tx.productOrder, $transaction: jest.fn(async fn => fn(tx)) }
    repo = new OrderRepository(prisma)
    service = new OrderService(repo, {} as never, { closeOrder: jest.fn() } as never, prisma)
  })
  it('returns merged stock and points and releases the coupon within one transaction', async () => {
    const result = await service.cancel(1, { userId: 7, type: 'user' })
    expect(result?.status).toBe('CANCELED')
    expect(tx.product.update).toHaveBeenCalledTimes(1)
    expect(tx.product.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { stock: { increment: 5 } } })
    expect(tx.stockLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: 'CANCEL_RELEASE', change: 5, stock: 15 }) })
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { points: { increment: 10 } } })
    expect(tx.pointRecord.create).toHaveBeenCalledWith({ data: expect.objectContaining({ change: 10, balance: 110 }) })
    expect(tx.userCoupon.updateMany).toHaveBeenCalledWith({ where: { orderId: 1, userId: 7, status: 'AVAILABLE' }, data: { orderId: null } })
    expect(tx.productOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 1, userId: 7, status: 'PENDING_PAYMENT', paymentStatus: 'UNPAID', paymentNo: null, paidAt: null },
    }))
  })
  it('does not release resources when a payment callback wins the update', async () => {
    tx.productOrder.updateMany.mockResolvedValue({ count: 0 })
    tx.productOrder.findFirst.mockReset().mockResolvedValue(makeOrder())
    await expect(service.cancel(1, { userId: 1, type: 'admin' })).rejects.toThrow(ConflictException)
    expect(tx.product.update).not.toHaveBeenCalled()
    expect(tx.user.update).not.toHaveBeenCalled()
  })
  it('does not release resources twice when another cancellation wins', async () => {
    tx.productOrder.updateMany.mockResolvedValue({ count: 0 })
    tx.productOrder.findFirst.mockReset().mockResolvedValueOnce(makeOrder()).mockResolvedValueOnce(makeOrder()).mockResolvedValueOnce({
      ...makeOrder(), status: 'CANCELED', paymentStatus: 'CLOSED',
    })
    await service.cancel(1, { userId: 1, type: 'admin' })
    expect(tx.product.update).not.toHaveBeenCalled()
    expect(tx.user.update).not.toHaveBeenCalled()
  })
  it('propagates resource failures to abort the transaction', async () => {
    tx.stockLog.create.mockRejectedValue(new Error('write failure'))
    await expect(service.cancel(1, { userId: 1, type: 'admin' })).rejects.toThrow('write failure')
    expect(tx.user.update).not.toHaveBeenCalled()
    expect(tx.productOrder.findUniqueOrThrow).not.toHaveBeenCalled()
  })
})

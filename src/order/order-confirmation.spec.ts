import 'reflect-metadata'
import { BadRequestException, ConflictException, ForbiddenException, Logger, NotFoundException, ValidationPipe } from '@nestjs/common'
import { OrderService } from './order.service'
import { OrderRepository } from './order.repository'
import { OrderController } from './order.controller'
import { OrderCompletionTask } from './order-completion.task'
import { AutoCompletionDto } from './dto/auto-completion.dto'
import { UserJwtGuard } from '../common/auth/guards/user-jwt.guard'
import { SKIP_RESPONSE_WRAP_KEY } from '../common/decorators/raw-response.decorator'

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }))
jest.mock('./order-preparation.service', () => ({ OrderPreparationService: class {} }))
jest.mock('../payment/payment.service', () => ({ PaymentService: class {} }))
jest.mock('../../generated/prisma/client', () => ({
  Prisma: { TransactionIsolationLevel: { ReadCommitted: 'ReadCommitted' } },
}))

const customer = { userId: 7, type: 'user' as const, role: 'CUSTOMER' }
const admin = { userId: 1, type: 'admin' as const }
const eligible = {
  status: 'PENDING_CONFIRMATION',
  paymentStatus: 'PAID',
  OR: [{ refundAmount: null }, { refundAmount: 0 }],
  installation: { is: { status: 'COMPLETED', customerConfirmed: false } },
}

describe('order completion confirmation', () => {
  let tx: any, prisma: any, service: OrderService, repo: OrderRepository
  beforeEach(() => {
    tx = {
      productOrder: {
        findFirst: jest.fn().mockResolvedValue({ status: 'PENDING_CONFIRMATION' }),
        findUnique: jest.fn().mockResolvedValue({ status: 'PENDING_CONFIRMATION' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      installationOrder: { update: jest.fn().mockResolvedValue({}) },
    }
    prisma = { productOrder: { findMany: jest.fn().mockResolvedValue([]) }, $transaction: jest.fn(async fn => fn(tx)) }
    repo = new OrderRepository(prisma)
    service = new OrderService(repo, {} as never, {} as never, prisma)
  })

  it('confirms only the owned order and preserves the installation completion timestamp', async () => {
    await expect(service.confirmCompletion(1, customer)).resolves.toEqual({ code: 200, message: '订单已确认完成', data: null })
    expect(tx.productOrder.findFirst).toHaveBeenCalledWith({ where: { id: 1, userId: 7 }, select: { status: true } })
    const completedAt = tx.productOrder.updateMany.mock.calls[0][0].data.completedAt
    expect(tx.productOrder.updateMany).toHaveBeenCalledWith({
      where: { ...eligible, id: 1, userId: 7 },
      data: { status: 'COMPLETED', completedAt, completionType: 'CUSTOMER_CONFIRMED' },
    })
    expect(tx.installationOrder.update).toHaveBeenCalledWith({
      where: { orderId: 1, status: 'COMPLETED', customerConfirmed: false },
      data: { customerConfirmed: true, customerConfirmedAt: completedAt },
    })
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it.each([admin, { ...customer, role: 'EMPLOYEE' }])('rejects non-customer actors %j', async actor => {
    await expect(service.confirmCompletion(1, actor)).rejects.toThrow(ForbiddenException)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it.each([0, -1, 1.5, 2147483648])('rejects invalid ID %s', async id => {
    await expect(service.confirmCompletion(id, customer)).rejects.toThrow(BadRequestException)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('hides missing and other customers orders', async () => {
    tx.productOrder.findFirst.mockResolvedValue(null)
    await expect(service.confirmCompletion(1, customer)).rejects.toThrow(NotFoundException)
    expect(tx.productOrder.updateMany).not.toHaveBeenCalled()
  })

  it.each(['PENDING_PAYMENT', 'PENDING_INSTALLATION', 'IN_SERVICE', 'COMPLETED', 'CANCELED', 'REFUNDING', 'REFUNDED'])('rejects %s', async status => {
    tx.productOrder.findFirst.mockResolvedValue({ status })
    await expect(service.confirmCompletion(1, customer)).rejects.toThrow(ConflictException)
    expect(tx.installationOrder.update).not.toHaveBeenCalled()
  })

  it('does not mark customer confirmation when a timeout or refund wins', async () => {
    tx.productOrder.updateMany.mockResolvedValue({ count: 0 })
    await expect(service.confirmCompletion(1, customer)).rejects.toThrow(ConflictException)
    expect(tx.installationOrder.update).not.toHaveBeenCalled()
  })

  it('propagates installation failure to reject the transaction', async () => {
    tx.installationOrder.update.mockRejectedValue(new Error('installation failure'))
    await expect(service.confirmCompletion(1, customer)).rejects.toThrow('installation failure')
    await expect(prisma.$transaction.mock.results[0].value).rejects.toThrow('installation failure')
  })

  it('rechecks deadline, refund and pause conditions at write time and never claims customer confirmation', async () => {
    prisma.productOrder.findMany.mockResolvedValue([{ id: 1 }])
    await expect(service.autoCompleteExpiredOrders()).resolves.toBe(1)
    const now = tx.productOrder.updateMany.mock.calls[0][0].data.completedAt
    const autoWhere = { ...eligible, autoCompletionPaused: false, confirmationDeadlineAt: { lte: now } }
    expect(prisma.productOrder.findMany).toHaveBeenCalledWith({
      where: { ...autoWhere, id: { gt: 0 } }, select: { id: true }, orderBy: { id: 'asc' }, take: 100,
    })
    expect(tx.productOrder.updateMany).toHaveBeenCalledWith({
      where: { ...autoWhere, id: 1 },
      data: { status: 'COMPLETED', completedAt: now, completionType: 'AUTO_TIMEOUT' },
    })
    expect(tx.installationOrder.update).not.toHaveBeenCalled()
  })

  it('skips a timeout when customer confirmation, refund or pause wins the conditional update', async () => {
    prisma.productOrder.findMany.mockResolvedValue([{ id: 1 }])
    tx.productOrder.updateMany.mockResolvedValue({ count: 0 })
    await expect(service.autoCompleteExpiredOrders()).resolves.toBe(0)
    expect(tx.installationOrder.update).not.toHaveBeenCalled()
  })

  it('advances pagination after failed records so later orders are still processed', async () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {})
    prisma.productOrder.findMany
      .mockResolvedValueOnce(Array.from({ length: 100 }, (_, i) => ({ id: i + 1 })))
      .mockResolvedValueOnce([{ id: 101 }])
    tx.productOrder.updateMany.mockRejectedValueOnce(new Error('transient error'))
    try {
      await expect(service.autoCompleteExpiredOrders()).resolves.toBe(100)
      expect(prisma.productOrder.findMany.mock.calls[1][0].where.id).toEqual({ gt: 100 })
      expect(log).toHaveBeenCalledTimes(1)
    } finally { log.mockRestore() }
  })

  it('runs no writes when no orders are due', async () => {
    await expect(service.autoCompleteExpiredOrders()).resolves.toBe(0)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it.each([true, false])('lets admins set pause=%s without resetting the deadline', async paused => {
    await service.setAutoCompletionPaused(1, paused, admin)
    expect(tx.productOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 1, status: 'PENDING_CONFIRMATION' }, data: { autoCompletionPaused: paused },
    })
  })

  it('rejects non-admin pause requests', async () => {
    await expect(service.setAutoCompletionPaused(1, true, customer)).rejects.toThrow(ForbiddenException)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects pause after the order has already completed', async () => {
    tx.productOrder.updateMany.mockResolvedValue({ count: 0 })
    await expect(service.setAutoCompletionPaused(1, true, admin)).rejects.toThrow(ConflictException)
  })

  it('protects new routes and preserves exact response envelopes', async () => {
    for (const [method, path] of [
      [OrderController.prototype.confirmCompletion, ':id/confirm-completion'],
      [OrderController.prototype.setAutoCompletionPaused, ':id/auto-completion'],
    ] as const) {
      expect(Reflect.getMetadata('path', method)).toBe(path)
      expect(Reflect.getMetadata('__guards__', method)).toContain(UserJwtGuard)
      expect(Reflect.getMetadata(SKIP_RESPONSE_WRAP_KEY, method)).toBe(true)
    }
    await expect(new OrderController(service).confirmCompletion(1, customer as any)).resolves.toEqual({
      code: 200, message: '订单已确认完成', data: null,
    })
  })

  it('delegates scheduled work to the service', async () => {
    const complete = jest.spyOn(service, 'autoCompleteExpiredOrders').mockResolvedValue(1)
    await new OrderCompletionTask(service).handleExpiredConfirmations()
    expect(complete).toHaveBeenCalledTimes(1)
  })
})

describe('auto completion input', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
  it.each([{}, { paused: 'false' }, { paused: 0 }, { paused: null }, { paused: true, confirmationDeadlineAt: '2099-01-01' }])('rejects invalid input %j', async value => {
    await expect(pipe.transform(value, { type: 'body', metatype: AutoCompletionDto })).rejects.toThrow(BadRequestException)
  })
})

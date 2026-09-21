import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import 'reflect-metadata'
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ValidationPipe } from '@nestjs/common'
import { OrderService } from './order.service'
import { OrderRepository } from './order.repository'
import { ArrangeInstallationDto } from './dto/arrange-installation.dto'
import { OrderController } from './order.controller'
import { SKIP_RESPONSE_WRAP_KEY } from '../common/decorators/raw-response.decorator'
import { UserJwtGuard } from '../common/auth/guards/user-jwt.guard'

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }))
jest.mock('./order-preparation.service', () => ({ OrderPreparationService: class {} }))
jest.mock('../payment/payment.service', () => ({ PaymentService: class {} }))
jest.mock('../../generated/prisma/client', () => ({
  Prisma: { TransactionIsolationLevel: { ReadCommitted: 'ReadCommitted' } },
}))

const dto = { installerName: '张师傅 / XX安装团队', installerPhone: '13800138000', remark: '到达前请电话联系' }
const admin = { userId: 1, type: 'admin' } as any

describe('arrange installation', () => {
  let tx: any, prisma: any, service: OrderService
  beforeEach(() => {
    tx = {
      productOrder: {
        findUnique: jest.fn().mockResolvedValue({ status: 'PENDING_INSTALLATION' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      installationOrder: { update: jest.fn().mockResolvedValue({}) },
    }
    prisma = { $transaction: jest.fn(async fn => fn(tx)) }
    service = new OrderService(new OrderRepository(prisma), {} as never, {} as never, prisma)
  })

  it('saves installation details and both statuses in the same transaction without changing booking or employee', async () => {
    await expect(service.arrangeInstallation(1, dto, admin)).resolves.toEqual({ code: 200, message: '安装安排成功', data: null })
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(tx.productOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 1, status: 'PENDING_INSTALLATION' }, data: { status: 'IN_SERVICE' },
    })
    expect(tx.installationOrder.update).toHaveBeenCalledWith({
      where: { orderId: 1 },
      data: { ...dto, assignedAt: expect.any(Date), status: 'IN_SERVICE' },
    })
  })

  it('allows omitting the remark', async () => {
    const { remark, ...required } = dto
    await service.arrangeInstallation(1, required, admin)
    expect(tx.installationOrder.update.mock.calls[0][0].data.remark).toBeNull()
  })

  it('rejects customers before accessing the database', async () => {
    await expect(service.arrangeInstallation(1, dto, { ...admin, type: 'user' })).rejects.toThrow(ForbiddenException)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it.each([0, -1, 1.5, 2147483648])('rejects invalid id %s', async id => {
    await expect(service.arrangeInstallation(id, dto, admin)).rejects.toThrow(BadRequestException)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('reports missing orders', async () => {
    tx.productOrder.findUnique.mockResolvedValue(null)
    await expect(service.arrangeInstallation(1, dto, admin)).rejects.toThrow(NotFoundException)
    expect(tx.productOrder.updateMany).not.toHaveBeenCalled()
  })

  it.each(['PENDING_PAYMENT', 'IN_SERVICE', 'COMPLETED', 'CANCELED', 'REFUNDING', 'REFUNDED'])('rejects status %s', async status => {
    tx.productOrder.findUnique.mockResolvedValue({ status })
    await expect(service.arrangeInstallation(1, dto, admin)).rejects.toThrow(ConflictException)
    expect(tx.installationOrder.update).not.toHaveBeenCalled()
  })

  it('rejects a concurrent status change without overwriting installer details', async () => {
    tx.productOrder.updateMany.mockResolvedValue({ count: 0 })
    await expect(service.arrangeInstallation(1, dto, admin)).rejects.toThrow(ConflictException)
    expect(tx.installationOrder.update).not.toHaveBeenCalled()
  })

  it('propagates installation write failures to abort the transaction', async () => {
    tx.installationOrder.update.mockRejectedValue(new Error('write failed'))
    await expect(service.arrangeInstallation(1, dto, admin)).rejects.toThrow('write failed')
    await expect(prisma.$transaction.mock.results[0].value).rejects.toThrow('write failed')
  })

  it('requires authentication and bypasses the default response wrapper', () => {
    expect(Reflect.getMetadata('__guards__', OrderController.prototype.arrangeInstallation)).toContain(UserJwtGuard)
    expect(Reflect.getMetadata(SKIP_RESPONSE_WRAP_KEY, OrderController.prototype.arrangeInstallation)).toBe(true)
  })
})

describe('installation request validation', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
  const validate = (body: object) => pipe.transform(body, { type: 'body', metatype: ArrangeInstallationDto })

  it('accepts free-form team names and trims strings', async () => {
    await expect(validate({ ...dto, installerName: '  张师傅 / XX安装团队  ' })).resolves.toEqual(dto)
  })

  it.each([
    { ...dto, installerName: undefined },
    { ...dto, installerName: '   ' },
    { ...dto, installerPhone: undefined },
    { ...dto, installerPhone: 13800138000 },
    { ...dto, installerPhone: ' ' },
    { ...dto, remark: 123 },
    { ...dto, appointmentDate: '2026-09-22' },
    { ...dto, timeSlot: 'AM' },
    { ...dto, employeeId: 2 },
  ])('rejects invalid or forbidden fields: %j', async body => {
    await expect(validate(body)).rejects.toThrow(BadRequestException)
  })
})


describe('complete installation', () => {
  let tx: any, prisma: any, service: OrderService
  beforeEach(() => {
    tx = {
      productOrder: {
        findUnique: jest.fn().mockResolvedValue({ status: 'IN_SERVICE' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      installationOrder: { update: jest.fn().mockResolvedValue({}) },
    }
    prisma = { $transaction: jest.fn(async fn => fn(tx)) }
    service = new OrderService(new OrderRepository(prisma), {} as never, {} as never, prisma)
  })

  it('completes installation and starts a seven-day confirmation period', async () => {
    await expect(service.completeInstallation(1, admin)).resolves.toEqual({
      code: 200, message: '安装已完工，待客户确认', data: null,
    })
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    const completedAt = tx.installationOrder.update.mock.calls[0][0].data.completedAt
    const confirmationDeadlineAt = new Date(completedAt.getTime() + 7 * 24 * 60 * 60 * 1000)
    expect(completedAt).toBeInstanceOf(Date)
    expect(tx.productOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 1, status: 'IN_SERVICE' },
      data: { status: 'PENDING_CONFIRMATION', confirmationDeadlineAt },
    })
    expect(tx.installationOrder.update).toHaveBeenCalledWith({
      where: { orderId: 1 },
      data: { status: 'COMPLETED', completedAt },
    })
    expect(tx.installationOrder.update.mock.calls[0][0].data.completedAt).toBe(completedAt)
  })

  it('rejects non-admins before database access', async () => {
    await expect(service.completeInstallation(1, { userId: 1, type: 'user' })).rejects.toThrow(ForbiddenException)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it.each([0, -1, 1.5, 2147483648])('rejects invalid ID %s', async id => {
    await expect(service.completeInstallation(id, admin)).rejects.toThrow(BadRequestException)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('reports missing orders', async () => {
    tx.productOrder.findUnique.mockResolvedValue(null)
    await expect(service.completeInstallation(1, admin)).rejects.toThrow(NotFoundException)
    expect(tx.productOrder.updateMany).not.toHaveBeenCalled()
  })

  it.each(['PENDING_PAYMENT', 'PENDING_INSTALLATION', 'COMPLETED', 'CANCELED', 'REFUNDING', 'REFUNDED'])('rejects %s orders', async status => {
    tx.productOrder.findUnique.mockResolvedValue({ status })
    await expect(service.completeInstallation(1, admin)).rejects.toThrow(ConflictException)
    expect(tx.productOrder.updateMany).not.toHaveBeenCalled()
    expect(tx.installationOrder.update).not.toHaveBeenCalled()
  })

  it('does not update installation if another request changed the order', async () => {
    tx.productOrder.updateMany.mockResolvedValue({ count: 0 })
    await expect(service.completeInstallation(1, admin)).rejects.toThrow(ConflictException)
    expect(tx.installationOrder.update).not.toHaveBeenCalled()
  })

  it('propagates installation write failures to abort the transaction', async () => {
    tx.installationOrder.update.mockRejectedValue(new Error('write failed'))
    await expect(service.completeInstallation(1, admin)).rejects.toThrow('write failed')
    await expect(prisma.$transaction.mock.results[0].value).rejects.toThrow('write failed')
  })

  it('maps a missing installation to a conflict and rejects the transaction', async () => {

    tx.installationOrder.update.mockRejectedValue(new PrismaClientKnownRequestError('missing', {
      code: 'P2025', clientVersion: '7.9.1',
    }))
    await expect(service.completeInstallation(1, admin)).rejects.toThrow('关联安装单不存在或已变化')
    await expect(prisma.$transaction.mock.results[0].value).rejects.toMatchObject({ code: 'P2025' })
  })

  it('exposes the authenticated completion route with the requested response', async () => {
    const handler = OrderController.prototype.completeInstallation
    expect(Reflect.getMetadata('path', handler)).toBe(':id/complete')
    expect(Reflect.getMetadata('__guards__', handler)).toContain(UserJwtGuard)
    expect(Reflect.getMetadata(SKIP_RESPONSE_WRAP_KEY, handler)).toBe(true)
    const controller = new OrderController(service)
    await expect(controller.completeInstallation(1, admin)).resolves.toEqual({
      code: 200, message: '安装已完工，待客户确认', data: null,
    })
  })
})

import 'reflect-metadata'
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ValidationPipe } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { EmployeeService } from './employee.service'
import { UpdateProjectQuoteDto } from './dto/update-project-quote.dto'
import { ConfirmProjectDto } from '../renovation-project/dto/confirm-project.dto'
import { EmployeeController } from './employee.controller'
import { UserJwtGuard } from '../common/auth/guards/user-jwt.guard'

describe('员工修改报价', () => {
  const user = { userId: 7, role: 'EMPLOYEE', type: 'user' } as const
  const item = { category: '人工', name: '安装', unit: '次', unitPrice: '12.35', quantity: '2.5' }
  const dto = { planId: 2, quoteVersion: 1, quoteItems: [item], quoteRemark: ' 调整数量 ' }
  let repo: any, tx: any, db: any, service: EmployeeService
  beforeEach(() => {
    repo = { findByUserId: jest.fn().mockResolvedValue({ id: 21, status: true, user: { role: 'EMPLOYEE', status: true } }), findProject: jest.fn().mockResolvedValue({ id: 3, employeeId: 21, status: 'PENDING_CONFIRM', quoteVersion: 1 }) }
    tx = { renewalPlan: { findFirst: jest.fn().mockResolvedValue({ id: 2 }) }, product: { count: jest.fn().mockResolvedValue(1) }, renovationProject: { update: jest.fn(), findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 3, quoteVersion: 2 }) }, projectQuoteItem: { deleteMany: jest.fn(), createMany: jest.fn() } }
    db = { $transaction: jest.fn(fn => fn(tx)) }
    service = new EmployeeService(repo, {} as any, {} as any, {} as any, db)
  })
  it('非负责人不能修改', async () => {
    repo.findProject.mockResolvedValue(null)
    await expect(service.updateProjectQuote(3, dto, user)).rejects.toBeInstanceOf(NotFoundException)
    expect(db.$transaction).not.toHaveBeenCalled()
  })
  it('接口使用报价路径和登录鉴权', () => {
    const method = EmployeeController.prototype.employeeUpdateQuote
    expect(Reflect.getMetadata('path', method)).toBe('projects/:id/quote')
    expect(Reflect.getMetadata('__guards__', method)).toContain(UserJwtGuard)
  })
  it('非员工不能修改', async () => {
    await expect(service.updateProjectQuote(3, dto, { ...user, role: 'CUSTOMER' })).rejects.toBeInstanceOf(ForbiddenException)
    expect(db.$transaction).not.toHaveBeenCalled()
  })
  it('禁用员工不能修改', async () => {
    repo.findByUserId.mockResolvedValue({ status: false })
    await expect(service.updateProjectQuote(3, dto, user)).rejects.toBeInstanceOf(ForbiddenException)
    expect(db.$transaction).not.toHaveBeenCalled()
  })
  it.each(['IN_SERVICE', 'COMPLETED', 'CANCELED', 'PENDING_QUOTE'])('拒绝状态 %s', async status => {
    repo.findProject.mockResolvedValue({ status, quoteVersion: 1 })
    await expect(service.updateProjectQuote(3, dto, user)).rejects.toBeInstanceOf(ConflictException)
    expect(db.$transaction).not.toHaveBeenCalled()
  })
  it('拒绝旧版本', async () => {
    await expect(service.updateProjectQuote(3, { ...dto, quoteVersion: 2 }, user)).rejects.toBeInstanceOf(ConflictException)
  })
  it('后端计算总金额，条件更新递增版本并保存备注，完整替换明细', async () => {
    await expect(service.updateProjectQuote(3, dto, user)).resolves.toEqual({ id: 3, quoteVersion: 2 })
    expect(tx.renovationProject.update).toHaveBeenCalledWith({ where: { id: 3, employeeId: 21, status: 'PENDING_CONFIRM', quoteVersion: 1 }, data: { planId: 2, quotedAmount: new Prisma.Decimal('30.88'), quoteVersion: { increment: 1 }, quoteRemark: '调整数量', updatedAt: expect.any(Date) } })
    expect(tx.projectQuoteItem.deleteMany).toHaveBeenCalledWith({ where: { projectId: 3 } })
    expect(tx.projectQuoteItem.createMany.mock.calls[0][0].data[0]).toMatchObject({ ...item, projectId: 3, sort: 0 })
  })
  it.each(['P2025', 'P2034'])('并发冲突 %s 返回409且不替换明细', async code => {
    tx.renovationProject.update.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('conflict', { code, clientVersion: '7.9.1' }))
    await expect(service.updateProjectQuote(3, dto, user)).rejects.toBeInstanceOf(ConflictException)
    expect(tx.projectQuoteItem.deleteMany).not.toHaveBeenCalled()
  })
  it('明细写入异常向事务传播，不返回成功', async () => {
    const error = new Error('write failed')
    tx.projectQuoteItem.createMany.mockRejectedValue(error)
    await expect(service.updateProjectQuote(3, dto, user)).rejects.toBe(error)
    expect(tx.renovationProject.findUniqueOrThrow).not.toHaveBeenCalled()
  })
  it('无效方案不写入', async () => {
    tx.renewalPlan.findFirst.mockResolvedValue(null)
    await expect(service.updateProjectQuote(3, dto, user)).rejects.toBeInstanceOf(BadRequestException)
    expect(tx.renovationProject.update).not.toHaveBeenCalled()
  })
  it('无效商品不写入', async () => {
    tx.product.count.mockResolvedValue(0)
    await expect(service.updateProjectQuote(3, { ...dto, quoteItems: [{ ...item, productId: 9 }] }, user)).rejects.toBeInstanceOf(BadRequestException)
  })
  it('总金额溢出时拒绝', async () => {
    await expect(service.updateProjectQuote(3, { ...dto, quoteItems: [{ ...item, unitPrice: '99999999', quantity: '2' }] }, user)).rejects.toBeInstanceOf(BadRequestException)
  })
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
  it.each([{ quoteItems: [] }, { quotedAmount: '1' }, { quoteVersion: 0 }, { quoteVersion: undefined }, { quoteItems: [{ ...item, quantity: '0' }] }, { quoteItems: [{ ...item, unitPrice: '-1' }] }])('拒绝非法请求 %j', async patch => {
    await expect(pipe.transform({ ...dto, ...patch }, { type: 'body', metatype: UpdateProjectQuoteDto })).rejects.toBeInstanceOf(BadRequestException)
  })
  it('确认必须提交版本', async () => {
    await expect(pipe.transform({}, { type: 'body', metatype: ConfirmProjectDto })).rejects.toBeInstanceOf(BadRequestException)
  })
})

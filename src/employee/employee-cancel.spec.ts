import 'reflect-metadata'
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ValidationPipe } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { EmployeeService } from './employee.service'
import { EmployeeRepository, employeeProjectDetailInclude } from './employee.repository'
import { EmployeeController } from './employee.controller'
import { UserJwtGuard } from '../common/auth/guards/user-jwt.guard'
import { CancelProjectDto } from './dto/cancel-project.dto'

describe('员工取消项目', () => {
  const user = { userId: 7, role: 'EMPLOYEE', type: 'user' } as const
  const dto: CancelProjectDto = { reason: '客户暂缓装修', expectedStatus: 'PENDING_CONFIRM' }
  let repo: any, service: EmployeeService
  beforeEach(() => {
    repo = { findByUserId: jest.fn().mockResolvedValue({ id: 21, status: true, user: { role: 'EMPLOYEE', status: true } }), findProject: jest.fn().mockResolvedValue({ id: 3, employeeId: 21, status: 'PENDING_CONFIRM' }), cancelProject: jest.fn().mockResolvedValue({ id: 3, status: 'CANCELED' }) }
    service = new EmployeeService(repo, {} as any, {} as any, {} as any, {} as any)
  })
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
  const validate = (body: unknown) => pipe.transform(body, { type: 'body', metatype: CancelProjectDto })
  it('登录鉴权与路由', () => {
    const method = EmployeeController.prototype.cancelProject
    expect(Reflect.getMetadata('path', method)).toBe('projects/:id/cancel')
    expect(Reflect.getMetadata('__guards__', method)).toContain(UserJwtGuard)
  })
  it('先trim再校验长度', async () => {
    expect((await validate({ ...dto, reason: '  原因 \n' })).reason).toBe('原因')
    expect((await validate({ ...dto, reason: ` ${'字'.repeat(500)} ` })).reason).toHaveLength(500)
  })
  it.each([{ reason: '' }, { reason: ' \n\t ' }, { reason: null }, { reason: 123 }, { reason: '字'.repeat(501) }, { reason: undefined }, { expectedStatus: undefined }, { expectedStatus: 'CANCELED' }, { expectedStatus: 'COMPLETED' }, { expectedStatus: 'PENDING_QUOTE' }, { employeeId: 21 }, { userId: 7 }, { agreed: true }])('拒绝非法参数 %j', async patch => {
    await expect(validate({ ...dto, ...patch })).rejects.toBeInstanceOf(BadRequestException)
  })
  it.each(['PENDING_CONFIRM', 'IN_SERVICE'] as const)('允许从%s取消', async expectedStatus => {
    repo.findProject.mockResolvedValue({ id: 3, employeeId: 21, status: expectedStatus })
    await expect(service.cancelProject(3, { ...dto, expectedStatus }, user)).resolves.toEqual({ id: 3, status: 'CANCELED' })
    expect(repo.cancelProject).toHaveBeenCalledWith(3, 21, { ...dto, expectedStatus })
  })
  it.each(['COMPLETED', 'CANCELED', 'PENDING_QUOTE', 'IN_SERVICE'])('状态%s不能按待确认取消', async status => {
    repo.findProject.mockResolvedValue({ id: 3, employeeId: 21, status })
    await expect(service.cancelProject(3, dto, user)).rejects.toBeInstanceOf(ConflictException)
    expect(repo.cancelProject).not.toHaveBeenCalled()
  })
  it('不存在或非负责人返回404', async () => {
    repo.findProject.mockResolvedValue(null)
    await expect(service.cancelProject(3, dto, user)).rejects.toBeInstanceOf(NotFoundException)
    expect(repo.findProject).toHaveBeenCalledWith(3, 21)
    expect(repo.cancelProject).not.toHaveBeenCalled()
  })
  it('普通用户返回403', async () => {
    await expect(service.cancelProject(3, dto, { ...user, role: 'CUSTOMER' })).rejects.toBeInstanceOf(ForbiddenException)
  })
  it.each([null, { status: false }, { status: true, user: { status: false } }, { status: true, user: { status: true, role: 'CUSTOMER' } }])('不可用员工返回403 %j', async employee => {
    repo.findByUserId.mockResolvedValue(employee)
    await expect(service.cancelProject(3, dto, user)).rejects.toBeInstanceOf(ForbiddenException)
    expect(repo.cancelProject).not.toHaveBeenCalled()
  })
  it.each([0, -1, 1.5, 2147483648])('非法项目ID %s', async id => {
    await expect(service.cancelProject(id, dto, user)).rejects.toBeInstanceOf(BadRequestException)
  })
  it.each(['P2025', 'P2034'])('并发失败%s返回409', async code => {
    repo.cancelProject.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('conflict', { code, clientVersion: '7.9.1' }))
    await expect(service.cancelProject(3, dto, user)).rejects.toBeInstanceOf(ConflictException)
  })
  it('保留其他数据库故障', async () => {
    const error = new Error('unavailable')
    repo.cancelProject.mockRejectedValue(error)
    await expect(service.cancelProject(3, dto, user)).rejects.toBe(error)
  })
  it('原子更新限定状态及负责人，仅保存取消记录并返回标准详情', async () => {
    const update = jest.fn().mockResolvedValue({ id: 3 })
    await new EmployeeRepository({ renovationProject: { update } } as any).cancelProject(3, 21, dto)
    expect(update).toHaveBeenCalledWith({ omit: { remark: true, progress: true }, where: { id: 3, employeeId: 21, status: 'PENDING_CONFIRM' }, data: { status: 'CANCELED', cancelReason: dto.reason, canceledAt: expect.any(Date), canceledByEmployeeId: 21, progress: dto.reason, progresses: { create: { status: 'CANCELED', content: dto.reason, createdBy: 'employee:21' } } }, include: employeeProjectDetailInclude })
  })
})

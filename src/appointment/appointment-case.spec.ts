import 'reflect-metadata'
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, UnauthorizedException, ValidationPipe } from '@nestjs/common'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import { AppointmentService } from './appointment.service'
import { AppointmentRepository } from './appointment.repository'
import { CreateCaseAppointmentDto } from './dto/create-case-appointment.dto'
import type { UserJwtPayload } from '../common/auth/interfaces/user-jwt-payload.interface'
import { UpdateAppointmentRequirementDto } from './dto/update-appointment-requirement.dto'

describe('案例同款报价预约', () => {
  const payload = { userId: 7, type: 'user', role: 'CUSTOMER' } as UserJwtPayload
  const account = { id: 7, mobile: '13800138000', status: true }
  let repo: { findUser: jest.Mock; findPublishedCase: jest.Mock; createCaseAppointment: jest.Mock }
  let service: AppointmentService

  beforeEach(() => {
    repo = {
      findUser: jest.fn().mockResolvedValue(account),
      findPublishedCase: jest.fn().mockResolvedValue({ id: 3 }),
      createCaseAppointment: jest.fn().mockResolvedValue({ id: 12, appointmentNo: 'APT123' }),
    }
    service = new AppointmentService(repo as unknown as AppointmentRepository)
  })

  it('使用登录用户和账号手机号提交案例预约', async () => {
    await expect(service.createCaseAppointment({ caseId: 3 }, payload)).resolves.toEqual({ appointmentId: 12, appointmentNo: 'APT123' })
    expect(repo.findUser).toHaveBeenCalledWith(7)
    expect(repo.createCaseAppointment).toHaveBeenCalledWith({ userId: 7, caseId: 3, mobile: account.mobile, appointmentNo: expect.stringMatching(/^APT\d{17}[A-F0-9]{6}$/) })
  })

  it.each([null, { ...account, status: false }])('拒绝无效或禁用账号 %j', async (user) => {
    repo.findUser.mockResolvedValue(user)
    await expect(service.createCaseAppointment({ caseId: 3 }, payload)).rejects.toBeInstanceOf(user ? ForbiddenException : UnauthorizedException)
    expect(repo.createCaseAppointment).not.toHaveBeenCalled()
  })

  it('案例不存在或未发布时返回 404', async () => {
    repo.findPublishedCase.mockResolvedValue(null)
    await expect(service.createCaseAppointment({ caseId: 3 }, payload)).rejects.toBeInstanceOf(NotFoundException)
    expect(repo.createCaseAppointment).not.toHaveBeenCalled()
  })

  it('重复预约返回 409', async () => {
    repo.createCaseAppointment.mockResolvedValue(null)
    await expect(service.createCaseAppointment({ caseId: 3 }, payload)).rejects.toBeInstanceOf(ConflictException)
  })

  it.each(['P2025', 'P2034'])('处理案例下线或并发提交异常 %s', async (code) => {
    repo.createCaseAppointment.mockRejectedValue(new PrismaClientKnownRequestError('Conflict', { code, clientVersion: '7.9.1' }))
    await expect(service.createCaseAppointment({ caseId: 3 }, payload)).rejects.toBeInstanceOf(code === 'P2025' ? NotFoundException : ConflictException)
  })

  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
  it.each([{}, { caseId: 0 }, { caseId: -1 }, { caseId: 1.5 }, { caseId: 2147483648 }, { caseId: 'abc' }, { caseId: 3, userId: 9 }, { caseId: 3, planId: 1 }])('拒绝无效请求 %j', async (body) => {
    await expect(pipe.transform(body, { type: 'body', metatype: CreateCaseAppointmentDto })).rejects.toThrow()
  })

  it('转换字符串案例 ID', async () => {
    await expect(pipe.transform({ caseId: '3' }, { type: 'body', metatype: CreateCaseAppointmentDto })).resolves.toEqual({ caseId: 3 })
  })
})

describe('案例预约事务', () => {
  const data = { appointmentNo: 'APT123', userId: 7, caseId: 3, mobile: '13800138000' }
  const setup = () => {
    const tx = {
      appointment: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 12, appointmentNo: 'APT123' }) },
      renovationCase: { update: jest.fn().mockResolvedValue({ id: 3 }) },
    }
    const transaction = jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx))
    const repo = new AppointmentRepository({ $transaction: transaction } as any)
    return { tx, transaction, repo }
  }

  it('在串行化事务内创建 CASE 预约并增加咨询次数', async () => {
    const { tx, transaction, repo } = setup()
    await expect(repo.createCaseAppointment(data)).resolves.toEqual({ id: 12, appointmentNo: 'APT123' })
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' })
    expect(tx.appointment.findFirst).toHaveBeenCalledWith({ where: { userId: 7, caseId: 3, type: 'CASE', status: { in: ['PENDING_CONTACT', 'PENDING_VISIT'] } }, select: { id: true } })
    expect(tx.renovationCase.update).toHaveBeenCalledWith({ where: { id: 3, status: 'PUBLISHED' }, data: { quoteCount: { increment: 1 } } })
    expect(tx.appointment.create).toHaveBeenCalledWith({ data: { ...data, type: 'CASE', source: '装修案例', status: 'PENDING_CONTACT' }, select: { id: true, appointmentNo: true } })
  })

  it('存在未结束预约时不创建也不增加次数', async () => {
    const { tx, repo } = setup()
    tx.appointment.findFirst.mockResolvedValue({ id: 9 })
    await expect(repo.createCaseAppointment(data)).resolves.toBeNull()
    expect(tx.appointment.create).not.toHaveBeenCalled()
    expect(tx.renovationCase.update).not.toHaveBeenCalled()
  })

  it('创建失败时向事务传播异常以触发回滚', async () => {
    const { tx, repo } = setup()
    const error = new Error('create failed')
    tx.appointment.create.mockRejectedValue(error)
    await expect(repo.createCaseAppointment(data)).rejects.toBe(error)
  })
})

describe('预约客户房屋信息补录', () => {
  const actor = { userId: 7, type: 'user', role: 'EMPLOYEE' } as UserJwtPayload
  let repo: Record<string, jest.Mock>
  let service: AppointmentService

  beforeEach(() => {
    repo = {
      findEmployeeByUserId: jest.fn().mockResolvedValue({
        id: 3,
        status: true,
        user: { status: true, role: 'EMPLOYEE' },
      }),
      updateRequirement: jest.fn().mockResolvedValue({
        id: 12,
        customerName: '张先生',
        estimatedAmount: null,
        estimateDescription: null,
        estimatedAt: null,
      }),
      findOneForEmployee: jest.fn(),
      appointmentConfirmVisit: jest.fn(),
    }
    service = new AppointmentService(repo as unknown as AppointmentRepository)
  })

  it('允许负责人部分补录并将面积转换为 Decimal', async () => {
    await service.updateRequirement(12, { customerName: '张先生', area: 89.5 }, actor)
    expect(repo.updateRequirement).toHaveBeenCalledWith(12, 3, {
      customerName: '张先生',
      area: expect.objectContaining({ d: expect.any(Array) }),
    })
  })

  it('拒绝空请求和非员工账号', async () => {
    await expect(service.updateRequirement(12, {}, actor)).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.updateRequirement(12, { city: '武汉' }, { ...actor, role: 'CUSTOMER' })).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('并发状态或负责人变化时返回冲突', async () => {
    repo.updateRequirement.mockRejectedValue(new PrismaClientKnownRequestError('changed', { code: 'P2025', clientVersion: '7.9.1' }))
    await expect(service.updateRequirement(12, { city: '武汉' }, actor)).rejects.toBeInstanceOf(ConflictException)
  })

  it('CASE 核心资料缺失时禁止确认上门', async () => {
    repo.findOneForEmployee.mockResolvedValue({
      type: 'CASE', status: 'PENDING_CONTACT', customerName: null, houseType: null,
      city: null, area: null, roomLayout: null, demand: null,
    })
    await expect(service.appointmentConfirmVisit(12, {
      visitDate: '2026-09-20', timeSlot: '09:00-12:00', visitAddress: '武汉市洪山区',
    }, actor)).rejects.toBeInstanceOf(BadRequestException)
    expect(repo.appointmentConfirmVisit).not.toHaveBeenCalled()
  })

  it('CASE 核心资料完整时允许确认上门', async () => {
    repo.findOneForEmployee.mockResolvedValue({
      type: 'CASE', status: 'PENDING_CONTACT', customerName: '张先生', houseType: '旧房',
      city: '武汉', area: 89, roomLayout: '三室两厅', demand: '客厅翻新',
    })
    repo.appointmentConfirmVisit.mockResolvedValue({ id: 12 })
    await service.appointmentConfirmVisit(12, {
      visitDate: '2026-09-20', timeSlot: '09:00-12:00', visitAddress: '武汉市洪山区',
    }, actor)
    expect(repo.appointmentConfirmVisit).toHaveBeenCalled()
  })

  const requirementPipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
  it.each([{ area: 0 }, { area: -1 }, { area: 1.234 }, { unknown: 'x' }])('拒绝非法补录参数 %j', async (body) => {
    await expect(requirementPipe.transform(body, { type: 'body', metatype: UpdateAppointmentRequirementDto })).rejects.toThrow()
  })
})

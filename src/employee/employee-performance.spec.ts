import 'reflect-metadata'
import { ForbiddenException, INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import request from 'supertest'
import { Prisma } from '../../generated/prisma/client'
import { EmployeeController } from './employee.controller'
import { EmployeeService } from './employee.service'
import { EmployeeRepository } from './employee.repository'
import { ResponseInterceptor } from '../common/interceptors/response.interceptor'
import { RenovationProjectRepository } from '../renovation-project/renovation-project.repository'

const user = { userId: 7, role: 'EMPLOYEE', type: 'user' } as const
const employee = { id: 21, status: true, user: { role: 'EMPLOYEE', status: true } }
const group = (employeeId: number, amount: string | null, count = 1) => ({
  employeeId, _sum: { contractAmount: amount === null ? null : new Prisma.Decimal(amount) }, _count: { _all: count },
})
const empty = { signedProjects: [], completedGroups: [] }
const makeService = (repo: any) => new EmployeeService(repo, {} as any, {} as any, {} as any, {} as any)

describe('员工业绩概览', () => {
  let repo: any, service: EmployeeService
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-28T04:00:00Z'))
    repo = { findByUserId: jest.fn().mockResolvedValue(employee), performanceSummary: jest.fn().mockResolvedValue(empty) }
    service = makeService(repo)
  })
  afterEach(() => jest.useRealTimers())

  it('空数据返回固定类型的默认值', async () => {
    await expect(service.performanceSummary(user)).resolves.toEqual({ month: '2026-09', signedCustomerCount: 0, signedAmount: '0.00', completedProjectCount: 0, companyRank: 1 })
  })
  it('手机号去重但项目金额累加，空手机号不计客户，空合同金额按零', async () => {
    repo.performanceSummary.mockResolvedValue({
      signedProjects: [
        { mobile: ' 13800000000 ', contractAmount: new Prisma.Decimal('0.10') },
        { mobile: '13800000000', contractAmount: new Prisma.Decimal('0.20') },
        { mobile: ' ', contractAmount: new Prisma.Decimal('1.23') },
        { mobile: '13900000000', contractAmount: null },
      ], completedGroups: [],
    })
    await expect(service.performanceSummary(user)).resolves.toMatchObject({ signedCustomerCount: 2, signedAmount: '1.53', companyRank: 1 })
  })
  it.each([[21, 1], [22, 1], [23, 3]])('同额同名次：员工 %i 排名 %i', async (id, rank) => {
    repo.findByUserId.mockResolvedValue({ ...employee, id })
    repo.performanceSummary.mockResolvedValue({ signedProjects: [], completedGroups: [group(21, '100.10', 2), group(22, '100.10', 3), group(23, '99.99')] })
    await expect(service.performanceSummary(user)).resolves.toMatchObject({ companyRank: rank, completedProjectCount: id === 21 ? 2 : id === 22 ? 3 : 1 })
  })
  it('有完工但合同金额为空仍参与零金额排名', async () => {
    repo.performanceSummary.mockResolvedValue({ signedProjects: [], completedGroups: [group(21, null, 2), group(22, '0'), group(23, '1')] })
    await expect(service.performanceSummary(user)).resolves.toMatchObject({ companyRank: 2, completedProjectCount: 2 })
  })
  it.each([
    ['2026-08-31T15:59:59.999Z', '2026-08', '2026-07-31T16:00:00Z', '2026-08-31T16:00:00Z'],
    ['2026-08-31T16:00:00Z', '2026-09', '2026-08-31T16:00:00Z', '2026-09-30T16:00:00Z'],
    ['2026-09-30T16:00:00Z', '2026-10', '2026-09-30T16:00:00Z', '2026-10-31T16:00:00Z'],
    ['2026-12-31T16:00:00Z', '2027-01', '2026-12-31T16:00:00Z', '2027-01-31T16:00:00Z'],
  ])('北京时间边界 %s', async (now, month, start, end) => {
    jest.setSystemTime(new Date(now))
    await expect(service.performanceSummary(user)).resolves.toMatchObject({ month })
    expect(repo.performanceSummary).toHaveBeenCalledWith(21, new Date(start), new Date(end))
  })
  it.each([null, { ...employee, status: false }, { ...employee, user: { role: 'EMPLOYEE', status: false } }, { ...employee, user: { role: 'CUSTOMER', status: true } }])('拒绝失效员工档案 %j', async record => {
    repo.findByUserId.mockResolvedValue(record)
    await expect(service.performanceSummary(user)).rejects.toBeInstanceOf(ForbiddenException)
    expect(repo.performanceSummary).not.toHaveBeenCalled()
  })
  it('数据库错误不伪装为零业绩', async () => {
    const error = new Error('database unavailable')
    repo.performanceSummary.mockRejectedValue(error)
    await expect(service.performanceSummary(user)).rejects.toBe(error)
  })
})

describe('业绩仓储查询', () => {
  it('签约与完工统一使用完成时间，排名只包含有效员工，同一事务快照读取', async () => {
    const tx = { renovationProject: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) } }
    const db = { $transaction: jest.fn(fn => fn(tx)) }
    const start = new Date('2026-08-31T16:00:00Z'), end = new Date('2026-09-30T16:00:00Z')
    await expect(new EmployeeRepository(db as any).performanceSummary(21, start, end)).resolves.toEqual(empty)
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'RepeatableRead' })
    expect(tx.renovationProject.findMany).toHaveBeenCalledWith({
      where: { employeeId: 21, status: 'COMPLETED', completedAt: { gte: start, lt: end } },
      select: { mobile: true, contractAmount: true },
    })
    expect(tx.renovationProject.groupBy).toHaveBeenCalledWith({
      by: ['employeeId'], where: { employeeId: { not: null }, employee: { is: { status: true, user: { is: { role: 'EMPLOYEE', status: true } } } }, status: 'COMPLETED', completedAt: { gte: start, lt: end } },
      _sum: { contractAmount: true }, _count: { _all: true },
    })
  })
  it('客户确认时间与成交金额原子更新，并保留版本和状态条件', async () => {
    const update = jest.fn().mockResolvedValue({})
    const repo = new RenovationProjectRepository({ renovationProject: { update } } as any)
    const project = { quotedAmount: new Prisma.Decimal('1.23'), quoteVersion: 2, updatedAt: new Date() }
    await repo.confirmProject(3, 7, project)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 3, userId: 7, status: 'PENDING_CONFIRM', quoteVersion: 2, updatedAt: project.updatedAt, quotedAmount: project.quotedAmount },
      data: expect.objectContaining({ status: 'IN_SERVICE', contractAmount: project.quotedAmount, quoteConfirmedAt: expect.any(Date) }),
    }))
    const conflict = new Error('conflict')
    update.mockRejectedValue(conflict)
    await expect(repo.confirmProject(3, 7, project)).rejects.toBe(conflict)
  })
})

describe('业绩接口 HTTP 鉴权和响应', () => {
  let app: INestApplication, jwt: JwtService, repo: any
  beforeAll(async () => {
    repo = { findByUserId: jest.fn().mockResolvedValue(employee), performanceSummary: jest.fn().mockResolvedValue(empty) }
    jwt = new JwtService({ secret: 'performance-test-secret' })
    const module = await Test.createTestingModule({
      controllers: [EmployeeController], providers: [
        { provide: EmployeeService, useValue: makeService(repo) },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile()
    app = module.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)))
    app.useLogger(false)
    await app.init()
  })
  afterAll(async () => { await app?.close() })
  const path = '/api/employee/performance/summary'
  it('未登录、无效和过期令牌返回 401', async () => {
    await request(app.getHttpServer()).get(path).expect(401)
    await request(app.getHttpServer()).get(path).set('Authorization', 'Bearer invalid').expect(401)
    await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${jwt.sign(user, { expiresIn: -1 })}`).expect(401)
  })
  it.each([{ ...user, role: 'CUSTOMER' }, { ...user, type: 'admin' }])('拒绝非员工登录身份 %j', async payload => {
    await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${jwt.sign(payload)}`).expect(403)
  })
  it('禁用员工返回 403', async () => {
    repo.findByUserId.mockResolvedValueOnce({ ...employee, status: false })
    await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${jwt.sign(user)}`).expect(403)
  })
  it('员工返回统一响应，外部参数不能改变统计身份', async () => {
    const response = await request(app.getHttpServer()).get(path).query({ employeeId: 99, month: '2020-01', companyId: 3 }).set('Authorization', `Bearer ${jwt.sign(user)}`).expect(200)
    expect(response.body).toEqual({ code: 200, message: 'success', data: { month: expect.stringMatching(/^\d{4}-\d{2}$/), signedCustomerCount: 0, signedAmount: '0.00', completedProjectCount: 0, companyRank: 1 } })
    expect(repo.performanceSummary).toHaveBeenLastCalledWith(21, expect.any(Date), expect.any(Date))
  })
})

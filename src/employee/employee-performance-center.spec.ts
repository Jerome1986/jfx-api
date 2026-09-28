import 'reflect-metadata'
import { ForbiddenException, INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import request from 'supertest'
import { Prisma } from '../../generated/prisma/client'
import { EmployeeController } from './employee.controller'
import { EmployeeService } from './employee.service'
import { EmployeeRepository } from './employee.repository'
import { QueryEmployeePerformanceDto } from './dto/query-employee-performance.dto'
import { ResponseInterceptor } from '../common/interceptors/response.interceptor'

const user = { userId: 7, role: 'EMPLOYEE', type: 'user' } as const
const employee = { id: 21, status: true, user: { role: 'EMPLOYEE', status: true } }
const decimal = (value: string) => new Prisma.Decimal(value)
const group = (employeeId: number, value: string | null, count = 1) => ({
  employeeId, _sum: { contractAmount: value === null ? null : decimal(value) }, _count: { _all: count },
})
const empty = () => ({ groups: [], employees: [{ id: 21, user: { realName: '张先生', nickname: null } }], totalSigned: { _sum: { contractAmount: null }, _count: { _all: 0 } }, completedProjectCount: 0, totalCompletedProjectCount: 0, projects: [] })
const makeService = (repo: any) => new EmployeeService(repo, {} as any, {} as any, {} as any, {} as any)
const pipe = () => new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })

describe('业绩中心统计', () => {
  let repo: any, service: EmployeeService
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-30T16:00:00Z'))
    repo = { findByUserId: jest.fn().mockResolvedValue(employee), performanceCenter: jest.fn().mockResolvedValue(empty()) }
    service = makeService(repo)
  })
  afterEach(() => jest.useRealTimers())

  it('默认北京时间本月，空数据与零除处理', async () => {
    const result = await service.performanceCenter(new QueryEmployeePerformanceDto(), user)
    expect(result).toMatchObject({ month: '2026-10', summary: { signedAmount: '0.00', signedProjectCount: 0, completedProjectCount: 0, averageSignedAmount: '0.00', companyRank: 1 }, totals: { signedAmount: '0.00', completedProjectCount: 0 }, rankings: [{ employeeId: 21, rank: 1, signedAmount: '0.00' }], currentEmployee: { rank: 1 }, projects: { list: [], total: 0, totalPage: 0 } })
    expect(repo.performanceCenter).toHaveBeenCalledWith(21, expect.anything(), { start: new Date('2026-09-30T16:00:00Z'), end: new Date('2026-10-31T16:00:00Z') })
  })
  it.each([
    ['2026-01', '2025-12-31T16:00:00Z', '2026-01-31T16:00:00Z'],
    ['2024-02', '2024-01-31T16:00:00Z', '2024-02-29T16:00:00Z'],
  ])('历史月份 %s 边界正确', async (month, start, end) => {
    await service.performanceCenter(Object.assign(new QueryEmployeePerformanceDto(), { month }), user)
    expect(repo.performanceCenter).toHaveBeenCalledWith(21, expect.anything(), { start: new Date(start), end: new Date(end) })
  })
  it('累计查询不限制日期', async () => {
    await service.performanceCenter(Object.assign(new QueryEmployeePerformanceDto(), { month: 'all' }), user)
    expect(repo.performanceCenter).toHaveBeenCalledWith(21, expect.anything(), undefined)
  })
  it('精确汇总、按完成数量算平均、并列排名、装修方案和分页', async () => {
    repo.performanceCenter.mockResolvedValue({ ...empty(),
      groups: [group(23, '0.10'), group(22, '0.30'), group(21, '0.30', 2)],
      employees: [21, 22, 23].map(id => ({ id, user: { realName: '员工' + id, nickname: null } })),
      totalSigned: { _sum: { contractAmount: decimal('999.99') }, _count: { _all: 10 } },
      completedProjectCount: 3, totalCompletedProjectCount: 8,
      projects: [{ id: 3, name: '改造', customerName: '李先生', mobile: ' 13812345678 ', contractAmount: decimal('0.10'), completedAt: new Date('2026-10-02'), plan: { name: '厨卫翻新方案' } }],
    })
    const result = await service.performanceCenter(Object.assign(new QueryEmployeePerformanceDto(), { pageSize: 2 }), user)
    expect(result.summary).toEqual({ signedAmount: '0.30', signedProjectCount: 3, averageSignedAmount: '0.10', completedProjectCount: 3, companyRank: 1 })
    expect(result.rankings.map(item => [item.employeeId, item.rank])).toEqual([[21, 1], [22, 1], [23, 3]])
    expect(result.totals).toEqual({ signedAmount: '999.99', completedProjectCount: 8 })
    expect(result.projects).toMatchObject({ total: 3, totalPage: 2, list: [{ mobile: '138****5678', signedAmount: '0.10', planName: '厨卫翻新方案' }] })
  })
  it('仅返回前五位，另外保留本人，空合同金额参与零金额排名', async () => {
    repo.performanceCenter.mockResolvedValue({ ...empty(), employees: [1, 2, 3, 4, 5, 21].map(id => ({ id, user: { realName: '员工', nickname: null } })), groups: [1, 2, 3, 4, 5].map(id => group(id, '10')).concat(group(21, null)) })
    const result = await service.performanceCenter(new QueryEmployeePerformanceDto(), user)
    expect(result.rankings).toHaveLength(5)
    expect(result.currentEmployee).toMatchObject({ employeeId: 21, rank: 6, signedAmount: '0.00' })
  })

  it('无完工员工也参与排名，零金额并列，停用员工不进入名单', async () => {
    repo.performanceCenter.mockResolvedValue({ ...empty(),
      employees: [21, 22, 23].map(id => ({ id, user: { realName: '员工', nickname: null } })),
      groups: [group(22, '50'), group(99, '999')],
    })
    const result = await service.performanceCenter(new QueryEmployeePerformanceDto(), user)
    expect(result.rankings.map(item => [item.employeeId, item.rank])).toEqual([[22, 1], [21, 2], [23, 2]])
    expect(result.summary.companyRank).toBe(2)
  })
  it('缺少装修方案返回 null，不回退到商品和服务明细', async () => {
    repo.performanceCenter.mockResolvedValue({ ...empty(),
      projects: [{ id: 3, name: '项目', customerName: '客户', mobile: '', contractAmount: decimal('10'), completedAt: null, plan: null }],
    })
    const result = await service.performanceCenter(new QueryEmployeePerformanceDto(), user)
    expect(result.projects.list[0]).toMatchObject({ planName: null, signedAmount: '10.00' })
    expect(result.projects.list[0]).not.toHaveProperty('content')
  })
  it('禁用员工不查询业绩', async () => {
    repo.findByUserId.mockResolvedValue({ ...employee, status: false })
    await expect(service.performanceCenter(new QueryEmployeePerformanceDto(), user)).rejects.toBeInstanceOf(ForbiddenException)
    expect(repo.performanceCenter).not.toHaveBeenCalled()
  })
})

describe('业绩中心仓储', () => {
  it.each([true, false])('日期筛选、负责人隔离、白名单字段与完成时间分页，月模式=%s', async monthly => {
    const project = { groupBy: jest.fn().mockResolvedValue([]), aggregate: jest.fn().mockResolvedValue(empty().totalSigned), count: jest.fn().mockResolvedValue(7), findMany: jest.fn().mockResolvedValue([]) }
    const tx = { renovationProject: project, employee: { findMany: jest.fn().mockResolvedValue([]) } }
    const db = { $transaction: jest.fn(fn => fn(tx)) }
    const range = monthly ? { start: new Date('2026-08-31T16:00:00Z'), end: new Date('2026-09-30T16:00:00Z') } : undefined
    await new EmployeeRepository(db as any).performanceCenter(21, Object.assign(new QueryEmployeePerformanceDto(), { pageNum: 2, pageSize: 5 }), range)
    expect(project.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { employeeId: { not: null }, employee: { is: { status: true, user: { is: { role: 'EMPLOYEE', status: true } } } }, status: 'COMPLETED', ...(range ? { completedAt: { gte: range.start, lt: range.end } } : {}) } }))
    expect(project.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ employeeId: 21, status: 'COMPLETED' }) }))
    expect(project.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { employeeId: 21, status: 'COMPLETED', ...(range ? { completedAt: { gte: range.start, lt: range.end } } : {}) }, orderBy: [{ completedAt: 'desc' }, { id: 'desc' }], skip: 5, take: 5 }))
    expect(tx.employee.findMany).toHaveBeenCalledWith({ where: { status: true, user: { is: { role: 'EMPLOYEE', status: true } } }, select: { id: true, user: { select: { realName: true, nickname: true } } } })
    expect(project.findMany.mock.calls[0][0].select.plan).toEqual({ select: { name: true } })
    expect(project.findMany.mock.calls[0][0].select.quoteItems).toBeUndefined()
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
  })
})

describe('业绩中心 HTTP', () => {
  let app: INestApplication, jwt: JwtService, repo: any
  beforeAll(async () => {
    repo = { findByUserId: jest.fn().mockResolvedValue(employee), performanceCenter: jest.fn().mockResolvedValue(empty()) }
    jwt = new JwtService({ secret: 'center-test-secret' })
    const module = await Test.createTestingModule({ controllers: [EmployeeController], providers: [{ provide: EmployeeService, useValue: makeService(repo) }, { provide: JwtService, useValue: jwt }] }).compile()
    app = module.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(pipe())
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)))
    app.useLogger(false)
    await app.init()
  })
  afterAll(async () => { await app?.close() })
  const path = '/api/employee/performance/center'
  it('JWT 身份和响应包装', async () => {
    const response = await request(app.getHttpServer()).get(path).query({ month: '2026-09', pageNum: '2', pageSize: '5' }).set('Authorization', 'Bearer ' + jwt.sign(user)).expect(200)
    expect(response.body).toMatchObject({ code: 200, message: 'success', data: { month: '2026-09', projects: { pageNum: 2, pageSize: 5 } } })
    expect(repo.findByUserId).toHaveBeenCalledWith(7)
  })
  it('未登录、无效和过期令牌返回 401', async () => {
    await request(app.getHttpServer()).get(path).expect(401)
    await request(app.getHttpServer()).get(path).set('Authorization', 'Bearer invalid').expect(401)
    await request(app.getHttpServer()).get(path).set('Authorization', 'Bearer ' + jwt.sign(user, { expiresIn: -1 })).expect(401)
  })
  it.each([{ ...user, role: 'CUSTOMER' }, { ...user, type: 'admin' }])('非员工身份返回 403', async payload => {
    await request(app.getHttpServer()).get(path).set('Authorization', 'Bearer ' + jwt.sign(payload)).expect(403)
  })
  it.each([{ month: '2026-13' }, { month: '2026-00' }, { month: '26-09' }, { month: '' }, { month: '0000-01' }, { month: ['2026-01', 'all'] }, { pageNum: 0 }, { pageNum: 1.5 }, { pageSize: 101 }, { pageSize: 'abc' }, { employeeId: 99 }, { companyId: 3 }])('拒绝非法查询参数 %j', async query => {
    await request(app.getHttpServer()).get(path).query(query).set('Authorization', 'Bearer ' + jwt.sign(user)).expect(400)
  })
})

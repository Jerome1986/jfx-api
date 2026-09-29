import 'reflect-metadata'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import request from 'supertest'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ResponseInterceptor } from '../common/interceptors/response.interceptor'
import { AdminEmployeePerformanceController } from './admin-employee-performance.controller'
import { AdminEmployeePerformanceService } from './admin-employee-performance.service'
import { AdminEmployeePerformanceRepository } from './admin-employee-performance.repository'
import { QueryAdminEmployeePerformanceDto } from './dto/query-admin-employee-performance.dto'

const staff = (id: number, patch: any = {}) => ({
  id, employeeNo: `E${id}`, department: '设计部', position: '设计师', status: true,
  user: { realName: `员工${id}`, nickname: null, mobile: `1380000000${id}`, role: 'EMPLOYEE', status: true }, ...patch,
})
const group = (employeeId: number, amount: string | null, count: number) => ({
  employeeId, _sum: { contractAmount: amount === null ? null : new Prisma.Decimal(amount) }, _count: { _all: count },
})
const query = (patch: Partial<QueryAdminEmployeePerformanceDto> = {}) => Object.assign(new QueryAdminEmployeePerformanceDto(), patch)

describe('后台员工业绩业务', () => {
  let repo: any, service: AdminEmployeePerformanceService
  const tx = {} as Prisma.TransactionClient
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-29T00:00:00Z'))
    repo = {
      withSnapshot: jest.fn(fn => fn(tx)),
      findEmployees: jest.fn().mockResolvedValue([staff(4), staff(3), staff(2), staff(1)]),
      aggregateCompleted: jest.fn().mockResolvedValue([group(1, '100.10', 2), group(2, '100.10', 1), group(3, '80.01', 3)]),
      findCustomerGroups: jest.fn().mockResolvedValue([]),
    }
    service = new AdminEmployeePerformanceService(repo)
  })
  afterEach(() => jest.useRealTimers())

  it('按金额降序、员工ID升序排列，排名为1、1、3，零业绩员工也参与', async () => {
    const result = await service.list(query())
    expect(result).toMatchObject({ month: '2026-09', total: 4, pageNum: 1, pageSize: 10, totalPage: 1 })
    expect(result.list.map(row => [row.employeeId, row.companyRank])).toEqual([[1, 1], [2, 1], [3, 3], [4, 4]])
    expect(result.list[0]).toMatchObject({ signedAmount: '100.10', averageSignedAmount: '50.05', completedProjectCount: 2 })
    expect(result.list[3]).toMatchObject({ signedAmount: '0.00', averageSignedAmount: '0.00', completedProjectCount: 0, signedCustomerCount: 0 })
    expect(repo.findEmployees).toHaveBeenCalledWith(tx)
    expect(repo.aggregateCompleted).toHaveBeenCalledWith(tx, { start: new Date('2026-08-31T16:00:00Z'), end: new Date('2026-09-30T16:00:00Z') })
  })
  it('停用员工展示业绩但不影响有效员工排名', async () => {
    repo.findEmployees.mockResolvedValue([staff(1, { status: false }), staff(2), staff(3), staff(4)])
    repo.aggregateCompleted.mockResolvedValue([group(1, '9999', 10), group(2, '100', 1), group(3, '100', 1)])
    const result = await service.list(query())
    expect(result.list.map(row => [row.employeeId, row.companyRank, row.isActive])).toEqual([[1, null, false], [2, 1, true], [3, 1, true], [4, 3, true]])
    expect(result.list[0].signedAmount).toBe('9999.00')
    const disabled = await service.list(query({ status: false }))
    expect(disabled.total).toBe(1)
    expect(disabled.list[0].employeeId).toBe(1)
  })
  it.each([{ role: 'CUSTOMER', status: true }, { role: 'EMPLOYEE', status: false }])('关联账号失效不参与排名 %j', async patch => {
    repo.findEmployees.mockResolvedValue([staff(1, { user: { ...staff(1).user, ...patch } }), staff(2)])
    const result = await service.list(query())
    expect(result.list[0]).toMatchObject({ status: true, isActive: false, companyRank: null })
    expect(result.list[1].companyRank).toBe(1)
  })
  it('筛选后保持公司排名，客户去重只查询当页员工', async () => {
    const result = await service.list(query({ keyword: '  E3 ', department: '设计部', status: true }))
    expect(result.total).toBe(1)
    expect(result.list[0].companyRank).toBe(3)
    expect(repo.findCustomerGroups).toHaveBeenCalledWith(tx, [3], expect.any(Object))
  })
  it.each(['E3', '员工3', '13800000003'])('按员工编号、姓名、手机号搜索 %s', async keyword => {
    const result = await service.list(query({ keyword }))
    expect(result.list.map(row => row.employeeId)).toEqual([3])
  })
  it('按岗位搜索、部门精确匹配，空白关键词不筛选', async () => {
    expect((await service.list(query({ keyword: '设计师' }))).total).toBe(4)
    expect((await service.list(query({ keyword: '   ' }))).total).toBe(4)
    expect((await service.list(query({ department: '设计' }))).total).toBe(0)
  })
  it('分页稳定且超出末页时不查询客户分组', async () => {
    const result = await service.list(query({ pageNum: 2, pageSize: 2 }))
    expect(result.list.map(row => row.employeeId)).toEqual([3, 4])
    expect(result.totalPage).toBe(2)
    expect(repo.findCustomerGroups).toHaveBeenCalledWith(tx, [3, 4], expect.any(Object))
    repo.findCustomerGroups.mockClear()
    expect(await service.list(query({ pageNum: 3, pageSize: 2 }))).toMatchObject({ list: [], total: 4, totalPage: 2 })
    expect(repo.findCustomerGroups).not.toHaveBeenCalled()
  })
  it('手机号按员工隔离，去除空白后去重且忽略空号码', async () => {
    repo.findCustomerGroups.mockResolvedValue([
      { employeeId: 1, mobile: ' 13800000000 ' }, { employeeId: 1, mobile: '13800000000' },
      { employeeId: 1, mobile: '' }, { employeeId: 1, mobile: '  ' },
      { employeeId: 2, mobile: '13800000000' },
    ])
    const result = await service.list(query())
    expect(result.list.map(row => row.signedCustomerCount)).toEqual([1, 1, 0, 0])
    expect(result.list[0].signedAmount).toBe('100.10')
  })
  it('空金额按零，平均值使用Decimal，姓名依次回退到昵称及员工', async () => {
    repo.findEmployees.mockResolvedValue([
      staff(1, { user: { ...staff(1).user, realName: '', nickname: '昵称' } }),
      staff(2, { user: { ...staff(2).user, realName: null, nickname: null } }),
    ])
    repo.aggregateCompleted.mockResolvedValue([group(1, '0.30', 3), group(2, null, 1)])
    const result = await service.list(query())
    expect(result.list[0]).toMatchObject({ name: '昵称', signedAmount: '0.30', averageSignedAmount: '0.10' })
    expect(result.list[1]).toMatchObject({ name: '员工', signedAmount: '0.00', averageSignedAmount: '0.00', completedProjectCount: 1 })
  })
  it.each([
    ['2026-08-31T15:59:59.999Z', '2026-08'],
    ['2026-08-31T16:00:00Z', '2026-09'],
    ['2026-12-31T16:00:00Z', '2027-01'],
  ])('默认月份按北京时间确定 %s', async (now, month) => {
    jest.setSystemTime(new Date(now))
    expect((await service.list(query())).month).toBe(month)
  })
  it('指定月份跨年边界，累计不传时间范围', async () => {
    await service.list(query({ month: '2026-12' }))
    expect(repo.aggregateCompleted).toHaveBeenLastCalledWith(tx, { start: new Date('2026-11-30T16:00:00Z'), end: new Date('2026-12-31T16:00:00Z') })
    expect((await service.list(query({ month: 'all' }))).month).toBe('all')
    expect(repo.aggregateCompleted).toHaveBeenLastCalledWith(tx, undefined)
    expect(repo.findCustomerGroups).toHaveBeenLastCalledWith(tx, [1, 2, 3, 4], undefined)
  })
  it('空员工表返回零总数，数据库错误不吞掉', async () => {
    repo.findEmployees.mockResolvedValue([])
    expect(await service.list(query())).toMatchObject({ list: [], total: 0, totalPage: 0 })
    const error = new Error('database unavailable')
    repo.aggregateCompleted.mockRejectedValue(error)
    await expect(service.list(query())).rejects.toBe(error)
  })
})

describe('后台业绩仓储', () => {
  it('同一快照读取，月份查询只统计完工，累计保留空完成时间，客户查询限制当页', async () => {
    const tx = { employee: { findMany: jest.fn().mockResolvedValue([]) }, renovationProject: { groupBy: jest.fn().mockResolvedValue([]) } }
    const db = { $transaction: jest.fn(fn => fn(tx)) }
    const repo = new AdminEmployeePerformanceRepository(db as any)
    const range = { start: new Date('2026-08-31T16:00:00Z'), end: new Date('2026-09-30T16:00:00Z') }
    await repo.withSnapshot(async snapshot => {
      await repo.findEmployees(snapshot)
      await repo.aggregateCompleted(snapshot, range)
      await repo.aggregateCompleted(snapshot)
      await repo.findCustomerGroups(snapshot, [2, 3], range)
    })
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'RepeatableRead' })
    expect(tx.employee.findMany.mock.calls[0][0]).not.toHaveProperty('where')
    expect(tx.renovationProject.groupBy.mock.calls[0][0]).toEqual({
      by: ['employeeId'], where: { status: 'COMPLETED', employeeId: { not: null }, completedAt: { gte: range.start, lt: range.end } },
      _sum: { contractAmount: true }, _count: { _all: true },
    })
    expect(tx.renovationProject.groupBy.mock.calls[1][0].where).toEqual({ status: 'COMPLETED', employeeId: { not: null } })
    expect(tx.renovationProject.groupBy.mock.calls[2][0]).toEqual({
      by: ['employeeId', 'mobile'], where: { status: 'COMPLETED', employeeId: { in: [2, 3] }, completedAt: { gte: range.start, lt: range.end } },
    })
  })
})

describe('后台业绩 HTTP 鉴权与参数', () => {
  let app: INestApplication, jwt: JwtService, service: any, admin: any
  const path = '/api/admin/employee/performance'
  beforeAll(async () => {
    jwt = new JwtService({ secret: 'admin-performance-test-secret' })
    service = { list: jest.fn().mockResolvedValue({ month: '2026-09', list: [], total: 0, pageNum: 1, pageSize: 10, totalPage: 0 }) }
    admin = { findUnique: jest.fn().mockResolvedValue({ status: true }) }
    const module = await Test.createTestingModule({ controllers: [AdminEmployeePerformanceController], providers: [
      { provide: AdminEmployeePerformanceService, useValue: service },
      { provide: JwtService, useValue: jwt },
      { provide: PrismaService, useValue: { admin } },
    ] }).compile()
    app = module.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)))
    app.useLogger(false)
    await app.init()
  })
  beforeEach(() => { jest.clearAllMocks() })
  afterAll(async () => { await app?.close() })
  const auth = () => `Bearer ${jwt.sign({ type: 'admin', userId: 1 })}`
  it('管理员返回统一包装和默认分页，且查询管理员档案', async () => {
    const response = await request(app.getHttpServer()).get(path).set('Authorization', auth()).expect(200)
    expect(response.body).toEqual({ code: 200, message: 'success', data: await service.list.mock.results[0].value })
    expect(service.list).toHaveBeenCalledWith(Object.assign(new QueryAdminEmployeePerformanceDto(), { pageNum: 1, pageSize: 10 }))
    expect(admin.findUnique).toHaveBeenCalledWith({ where: { id: 1 }, select: { status: true } })
  })
  it('月份、分页和布尔筛选转换', async () => {
    await request(app.getHttpServer()).get(path).query({ month: 'all', pageNum: '2', pageSize: '20', status: 'false', keyword: '员工', department: '设计部' }).set('Authorization', auth()).expect(200)
    expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ month: 'all', pageNum: 2, pageSize: 20, status: false, keyword: '员工', department: '设计部' }))
  })
  it('未登录、无效和过期令牌返回401', async () => {
    await request(app.getHttpServer()).get(path).expect(401)
    await request(app.getHttpServer()).get(path).set('Authorization', 'Bearer invalid').expect(401)
    await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${jwt.sign({ type: 'admin', userId: 1 }, { expiresIn: -1 })}`).expect(401)
    expect(service.list).not.toHaveBeenCalled()
  })
  it.each(['EMPLOYEE', 'CUSTOMER'])('用户身份%s不能访问后台，即使ID与管理员相同', async role => {
    await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${jwt.sign({ type: 'user', userId: 1, role })}`).expect(403)
    expect(admin.findUnique).not.toHaveBeenCalled()
    expect(service.list).not.toHaveBeenCalled()
  })
  it.each([null, { status: false }])('管理员缺失或停用返回403 %j', async record => {
    admin.findUnique.mockResolvedValueOnce(record)
    await request(app.getHttpServer()).get(path).set('Authorization', auth()).expect(403)
    expect(service.list).not.toHaveBeenCalled()
  })
  it.each([
    { month: '2026-13' }, { month: '2026-1' }, { month: '' }, { month: 'ALL' },
    { pageNum: '0' }, { pageNum: '1.5' }, { pageNum: '2147483648' },
    { pageSize: '0' }, { pageSize: '101' }, { status: '0' }, { status: 'yes' }, { employeeId: '1' },
  ])('拒绝非法参数%j', async parameters => {
    await request(app.getHttpServer()).get(path).query(parameters).set('Authorization', auth()).expect(400)
    expect(service.list).not.toHaveBeenCalled()
  })
})

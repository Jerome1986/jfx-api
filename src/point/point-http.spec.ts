import 'reflect-metadata'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { PrismaService } from '../prisma/prisma.service'
import { ResponseInterceptor } from '../common/interceptors/response.interceptor'
import { PointController } from './point.controller'
import { PointGuard } from './point.guard'
import { PointRepository } from './point.repository'
import { PointService } from './point.service'

describe('后台积分 HTTP 接口', () => {
  let app: INestApplication
  const jwt = new JwtService({ secret: 'point-test-only' })
  const adminToken = jwt.sign({ userId: 7, type: 'admin' })
  const userToken = jwt.sign({ userId: 7, type: 'user' })
  const dto = { direction: 'increase', amount: 100, reason: '售后补偿', requestId: 'adjust-1' }
  const account = { id: 1001, nickname: '张三', mobile: '13800138000', points: 120, totalPointsEarned: 500, totalPointsUsed: 380, pointDebt: 30 }
  const flow = {
    id: 1, userId: 1001, user: { nickname: '张三' }, flowType: 'MANUAL_INCREASE',
    balanceBefore: 120, balance: 190, debtBefore: 30, debtAfter: 0,
    orderId: null, orderNo: null, refundNo: null, createdAt: new Date('2026-10-06T08:00:00Z'),
    source: '管理员操作', description: '售后补偿', operatorId: 7, operator: '管理员', earned: 100, offset: 30, amount: 100,
  }
  const repo = {
    accounts: jest.fn(), account: jest.fn(), flows: jest.fn(), flow: jest.fn(), adjust: jest.fn(), orders: jest.fn(),
  }
  const db = { admin: { findUnique: jest.fn() } }
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PointController],
      providers: [
        PointService, PointGuard,
        { provide: PointRepository, useValue: repo },
        { provide: PrismaService, useValue: db },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile()
    app = module.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)))
    await app.init()
  })
  beforeEach(() => {
    jest.resetAllMocks()
    db.admin.findUnique.mockResolvedValue({ status: true })
    repo.accounts.mockResolvedValue([[account], 1])
    repo.account.mockResolvedValue(account)
    repo.flows.mockResolvedValue([[flow], 1])
    repo.flow.mockResolvedValue(flow)
    repo.adjust.mockResolvedValue(flow)
    repo.orders.mockResolvedValue([])
  })
  afterAll(async () => { await app.close() })
  const routes = [
    ['get', '/api/point/accounts'], ['get', '/api/point/accounts/1001'],
    ['post', '/api/point/accounts/1001/adjust'], ['get', '/api/point/flows'], ['get', '/api/point/flows/PF1'],
  ] as const
  it.each(routes)('%s %s 需要登录', async (method, path) => {
    await request(app.getHttpServer())[method](path).expect(401)
  })
  it.each(routes)('%s %s 拒绝普通用户', async (method, path) => {
    await request(app.getHttpServer())[method](path).auth(userToken, { type: 'bearer' }).expect(403)
  })
  it.each([null, { status: false }])('拒绝不存在或已禁用的管理员 %j', async admin => {
    db.admin.findUnique.mockResolvedValue(admin)
    for (const [method, path] of routes) {
      await request(app.getHttpServer())[method](path).auth(adminToken, { type: 'bearer' }).expect(403)
    }
  })
  it('账户列表、详情使用同一字段与统计口径，false 不会转换成 true', async () => {
    const list = await request(app.getHttpServer()).get('/api/point/accounts?hasDebt=false')
      .auth(adminToken, { type: 'bearer' }).expect(200)
    expect(list.body).toEqual({
      code: 200, message: 'success', data: { list: [{
        userId: 1001, nickname: '张三', phone: '13800138000', balance: 120, earned: 500, used: 380, debt: 30,
      }], total: 1, page: 1, pageSize: 10 },
    })
    expect(repo.accounts.mock.calls[0][0]).toMatchObject({ hasDebt: false, page: 1, pageSize: 10 })
    const detail = await request(app.getHttpServer()).get('/api/point/accounts/1001')
      .auth(adminToken, { type: 'bearer' }).expect(200)
    expect(detail.body.data).toEqual(list.body.data.list[0])
  })
  it('已有用户无积分返回0，用户不存在返回404', async () => {
    repo.account.mockResolvedValue({ ...account, points: 0, totalPointsEarned: 0, totalPointsUsed: 0, pointDebt: 0 })
    const res = await request(app.getHttpServer()).get('/api/point/accounts/1001').auth(adminToken, { type: 'bearer' }).expect(200)
    expect(res.body.data).toMatchObject({ balance: 0, earned: 0, used: 0, debt: 0 })
    repo.account.mockResolvedValue(null)
    await request(app.getHttpServer()).get('/api/point/accounts/1001').auth(adminToken, { type: 'bearer' }).expect(404)
  })
  it('调整原因去除首尾空白，管理员只来自登录身份', async () => {
    const res = await request(app.getHttpServer()).post('/api/point/accounts/1001/adjust')
      .auth(adminToken, { type: 'bearer' }).send({ ...dto, reason: '  售后补偿  ' }).expect(200)
    expect(repo.adjust).toHaveBeenCalledWith(1001, dto, 7)
    expect(res.body.data).toEqual({
      flowId: 'PF1', userId: 1001, amount: 100, offset: 30, balanceBefore: 120, balanceAfter: 190, debtBefore: 30, debtAfter: 0,
    })
  })
  it.each([
    {}, { ...dto, direction: 'other' }, { ...dto, amount: 0 }, { ...dto, amount: -1 },
    { ...dto, amount: 1.5 }, { ...dto, amount: '100' }, { ...dto, amount: 1000000001 },
    { ...dto, reason: '  ' }, { ...dto, reason: '字'.repeat(301) }, { ...dto, reason: null },
    { ...dto, requestId: '' }, { ...dto, requestId: 'x'.repeat(101) }, { ...dto, requestId: 'has space' },
    { ...dto, balanceAfter: 999 }, { ...dto, operatorId: 9 },
  ])('调整拒绝非法参数 %j', async invalid => {
    await request(app.getHttpServer()).post('/api/point/accounts/1001/adjust')
      .auth(adminToken, { type: 'bearer' }).send(invalid).expect(400)
    expect(repo.adjust).not.toHaveBeenCalled()
  })
  it.each([
    '/accounts?page=0', '/accounts?pageSize=11', '/accounts?hasDebt=0', '/accounts?hasDebt=',
    '/accounts/-1', '/accounts/2147483648', '/accounts/abc',
    '/flows?userId=0', '/flows?type=UNKNOWN', '/flows?startDate=2026-02-30',
    '/flows?startDate=2026-1-1', '/flows?startDate=2026-10-07&endDate=2026-10-06',
    '/flows/PF0', '/flows/1', '/flows/PF2147483648',
  ])('拒绝非法查询或路径 %s', async path => {
    await request(app.getHttpServer()).get('/api/point' + path).auth(adminToken, { type: 'bearer' }).expect(400)
  })
  it('流水列表返回快照、ISO 时间及空关联，详情补充审计信息', async () => {
    const list = await request(app.getHttpServer()).get('/api/point/flows?userId=1001')
      .auth(adminToken, { type: 'bearer' }).expect(200)
    expect(list.body.data.list[0]).toEqual({
      id: 'PF1', userId: 1001, nickname: '张三', type: 'MANUAL_INCREASE', before: 120, after: 190,
      debtBefore: 30, debtAfter: 0, orderId: null, orderNo: null, occurredAt: '2026-10-06T08:00:00.000Z', source: '管理员操作',
    })
    const detail = await request(app.getHttpServer()).get('/api/point/flows/PF1')
      .auth(adminToken, { type: 'bearer' }).expect(200)
    expect(detail.body.data).toMatchObject({
      ...list.body.data.list[0], refundNo: null, reason: '售后补偿', operatorId: 7, operatorName: '管理员', earned: 100, offset: 30,
    })
  })
  it('关联订单号批量补全订单ID', async () => {
    repo.flows.mockResolvedValue([[{ ...flow, orderNo: 'ORDER1' }], 1])
    repo.orders.mockResolvedValue([{ id: 9, orderNo: 'ORDER1' }])
    const res = await request(app.getHttpServer()).get('/api/point/flows').auth(adminToken, { type: 'bearer' }).expect(200)
    expect(res.body.data.list[0]).toMatchObject({ orderId: 9, orderNo: 'ORDER1' })
    expect(repo.orders).toHaveBeenCalledWith(['ORDER1'])
  })
  it('流水不存在返回404', async () => {
    repo.flow.mockResolvedValue(null)
    await request(app.getHttpServer()).get('/api/point/flows/PF99').auth(adminToken, { type: 'bearer' }).expect(404)
  })
})

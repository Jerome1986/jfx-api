import 'reflect-metadata'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ResponseInterceptor } from '../common/interceptors/response.interceptor'
import { PointRuleController } from './point-rule.controller'
import { PointRuleGuard } from './point-rule.guard'
import { PointRuleRepository } from './point-rule.repository'
import { PointRuleService } from './point-rule.service'

describe('积分规则设置', () => {
  let app: INestApplication
  const jwt = new JwtService({ secret: 'point-rule-test' })
  const token = jwt.sign({ userId: 7, type: 'admin' })
  const dto = {
    rewardEnabled: true, rewardYuan: '100.00', rewardPoints: 10,
    deductEnabled: true, deductPoints: 100, deductYuan: '1.00', limit: 20,
  }
  const record = {
    ...dto, id: 1, version: 1, updatedById: 7,
    rewardYuan: new Prisma.Decimal('100'), deductYuan: new Prisma.Decimal('1'),
    createdAt: new Date(), updatedAt: new Date(),
  }
  const db = {
    admin: { findUnique: jest.fn() },
    pointRule: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PointRuleController],
      providers: [
        PointRuleService, PointRuleRepository, PointRuleGuard,
        { provide: PrismaService, useValue: db },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile()
    app = module.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({
      transform: true, whitelist: true, forbidNonWhitelisted: true,
    }))
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)))
    await app.init()
  })
  beforeEach(() => {
    jest.resetAllMocks()
    db.admin.findUnique.mockResolvedValue({ status: true })
    db.pointRule.findUnique.mockResolvedValue(null)
    db.pointRule.upsert.mockResolvedValue(record)
    db.pointRule.update.mockResolvedValue({ ...record, version: 2 })
  })
  afterAll(async () => { await app.close() })

  it('未配置时查询返回 null', async () => {
    const res = await request(app.getHttpServer()).get('/api/point-rule')
      .auth(token, { type: 'bearer' }).expect(200)
    expect(res.body).toEqual({ code: 200, message: 'success', data: null })
  })
  it('保存并回显规则，操作人由登录信息获取', async () => {
    const res = await request(app.getHttpServer()).post('/api/point-rule')
      .auth(token, { type: 'bearer' }).send(dto).expect(200)
    expect(res.body.data).toMatchObject({ ...dto, id: 1, version: 1, updatedById: 7 })
    expect(db.pointRule.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      create: { ...dto, id: 1, version: 1, updatedById: 7 },
      update: { ...dto, updatedById: 7, version: { increment: 1 } },
    })
    db.pointRule.findUnique.mockResolvedValue(record)
    const current = await request(app.getHttpServer()).get('/api/point-rule')
      .auth(token, { type: 'bearer' }).expect(200)
    expect(current.body.data).toEqual(res.body.data)
  })
  it.each(['get', 'post'] as const)('%s 拒绝未登录请求', async method => {
    await request(app.getHttpServer())[method]('/api/point-rule').expect(401)
    expect(db.pointRule.upsert).not.toHaveBeenCalled()
  })
  it('拒绝普通用户', async () => {
    await request(app.getHttpServer()).post('/api/point-rule')
      .auth(jwt.sign({ userId: 7, type: 'user' }), { type: 'bearer' }).send(dto).expect(403)
    expect(db.pointRule.upsert).not.toHaveBeenCalled()
  })
  it.each([null, { status: false }])('拒绝不存在或禁用的管理员 %j', async admin => {
    db.admin.findUnique.mockResolvedValue(admin)
    await request(app.getHttpServer()).post('/api/point-rule')
      .auth(token, { type: 'bearer' }).send(dto).expect(403)
    expect(db.pointRule.upsert).not.toHaveBeenCalled()
  })
  it.each([
    {}, { ...dto, version: 99 }, { ...dto, updatedById: 9 }, { ...dto, id: 2 },
    { ...dto, rewardYuan: 1 }, { ...dto, rewardYuan: '0' },
    { ...dto, rewardYuan: '100000000' }, { ...dto, deductYuan: '0.001' },
    { ...dto, rewardPoints: 1.5 }, { ...dto, deductPoints: 0 },
    { ...dto, limit: 101 }, { ...dto, limit: -1 },
    { ...dto, rewardEnabled: 'false' }, { ...dto, deductEnabled: null },
    { ...dto, rewardEnabled: false, rewardYuan: '0' },
  ])('拒绝不合法或伪造的字段 %j', async invalid => {
    await request(app.getHttpServer()).post('/api/point-rule')
      .auth(token, { type: 'bearer' }).send(invalid).expect(400)
    expect(db.pointRule.upsert).not.toHaveBeenCalled()
  })
  it.each([0, 100])('允许关闭开关且保留有效比例，抵扣上限 %i', async limit => {
    const data = { ...dto, rewardEnabled: false, deductEnabled: false, limit }
    await request(app.getHttpServer()).post('/api/point-rule')
      .auth(token, { type: 'bearer' }).send(data).expect(200)
    expect(db.pointRule.upsert.mock.calls[0][0].create).toMatchObject(data)
  })
  it('首次保存主键冲突后转为更新，版本仍递增', async () => {
    db.pointRule.upsert.mockRejectedValue(new Prisma.PrismaClientKnownRequestError(
      'duplicate', { code: 'P2002', clientVersion: '7.9.1' },
    ))
    const repo = new PointRuleRepository(db as unknown as PrismaService)
    await expect(repo.save(dto, 7)).resolves.toMatchObject({ id: 1, version: 2 })
    expect(db.pointRule.update).toHaveBeenCalledWith({
      where: { id: 1 }, data: { ...dto, updatedById: 7, version: { increment: 1 } },
    })
  })
  it('其他数据库异常原样抛出', async () => {
    const error = new Error('database unavailable')
    db.pointRule.upsert.mockRejectedValue(error)
    const repo = new PointRuleRepository(db as unknown as PrismaService)
    await expect(repo.save(dto, 7)).rejects.toBe(error)
    expect(db.pointRule.update).not.toHaveBeenCalled()
  })
})

import 'reflect-metadata'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ResponseInterceptor } from '../common/interceptors/response.interceptor'
import {
  AdminProjectController,
  AppointmentProjectController,
} from './admin-project.controller'
import { AdminProjectService } from './admin-project.service'
import { AdminProjectGuard } from './admin-project.guard'
import { RenovationProjectController } from './renovation-project.controller'
import { RenovationProjectService } from './renovation-project.service'
import { RenovationProjectRepository } from './renovation-project.repository'

describe('装修项目后台与小程序 HTTP 兼容', () => {
  let app: INestApplication
  const jwt = new JwtService({ secret: 'project-test-only' })
  const adminToken = jwt.sign({ userId: 7, type: 'admin', role: 'SUPER_ADMIN' })
  const userToken = jwt.sign({ userId: 7, type: 'user', role: 'CUSTOMER' })
  const employeeToken = jwt.sign({ userId: 7, type: 'user', role: 'EMPLOYEE' })
  const otherToken = jwt.sign({ userId: 8, type: 'user', role: 'CUSTOMER' })
  const disabledToken = jwt.sign({
    userId: 9,
    type: 'admin',
    role: 'SUPER_ADMIN',
  })
  const absentAdminToken = jwt.sign({
    userId: 10,
    type: 'admin',
    role: 'SUPER_ADMIN',
  })
  const item = {
    category: '主材',
    name: '地砖',
    unit: '平方米',
    unitPrice: '100.00',
    quantity: '20',
  }
  const legacyProject = {
    id: 1,
    userId: 7,
    status: 'PENDING_CONFIRM',
    quoteVersion: 1,
    quotedAmount: new Prisma.Decimal('2000'),
    quoteItems: [{ ...item, id: 1 }],
    plan: { id: 5, name: '方案' },
    updatedAt: new Date('2026-09-22T02:00:00Z'),
  }
  const adminService: Record<string, jest.Mock> = Object.fromEntries(
    [
      'list',
      'detail',
      'create',
      'edit',
      'assign',
      'convert',
      'quotation',
      'progress',
      'followUp',
    ].map((name) => [name, jest.fn().mockResolvedValue({ id: 1 })]),
  )
  const findFirst = jest.fn(async ({ where }) =>
    where.id === 1 && where.userId === 7 ? legacyProject : null,
  )
  const findMany = jest.fn(async ({ where }) =>
    where.userId === 7 ? [legacyProject] : [],
  )
  const update = jest.fn(async (_args: any) => ({
    ...legacyProject,
    status: 'IN_SERVICE',
    contractAmount: new Prisma.Decimal('2000'),
  }))
  const db = {
    admin: {
      findUnique: jest.fn(async ({ where }) =>
        where.id === 7
          ? { status: true }
          : where.id === 9
            ? { status: false }
            : null,
      ),
    },
    renovationProject: {
      findFirst,
      findMany,
      count: jest.fn().mockResolvedValue(1),
      update,
    },
  }

  const routes = [
    ['get', '/api/project', 'list', undefined],
    ['get', '/api/project/1', 'detail', undefined],
    [
      'post',
      '/api/project',
      'create',
      { name: '厨房', customerName: '张先生', mobile: '13800138000' },
    ],
    ['patch', '/api/project/1', 'edit', { name: '厨房改造' }],
    ['patch', '/api/project/1/assignee', 'assign', { employeeId: 3 }],
    [
      'post',
      '/api/appointment/10/convert',
      'convert',
      { projectName: '厨房改造' },
    ],
    [
      'put',
      '/api/project/1/quotation',
      'quotation',
      { quoteVersion: 1, items: [item] },
    ],
    [
      'post',
      '/api/project/1/progress',
      'progress',
      {
        status: 'IN_SERVICE',
        content: '确认',
        quoteVersion: 1,
        contractAmount: '1800.00',
      },
    ],
    [
      'post',
      '/api/project/1/follow-up',
      'followUp',
      { employeeId: 3, content: '联系客户' },
    ],
  ] as const

  beforeAll(async () => {
    const repository = new RenovationProjectRepository(
      db as unknown as PrismaService,
    )
    const module = await Test.createTestingModule({
      controllers: [
        AdminProjectController,
        AppointmentProjectController,
        RenovationProjectController,
      ],
      providers: [
        AdminProjectGuard,
        { provide: JwtService, useValue: jwt },
        { provide: PrismaService, useValue: db },
        { provide: AdminProjectService, useValue: adminService },
        {
          provide: RenovationProjectService,
          useValue: new RenovationProjectService(repository),
        },
      ],
    }).compile()
    app = module.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)))
    await app.init()
  })
  beforeEach(() => jest.clearAllMocks())
  afterAll(async () => {
    await app?.close()
  })

  it.each(routes)(
    '%s %s 允许管理员并统一返回 200',
    async (method, path, name, data) => {
      const req = request(app.getHttpServer())
        [method](path)
        .set('Authorization', `Bearer ${adminToken}`)
      if (data) req.send(data)
      const response = await req.expect(200)
      expect(response.body).toEqual({
        code: 200,
        message: '操作成功',
        data: { id: 1 },
      })
      expect(adminService[name]).toHaveBeenCalledTimes(1)
    },
  )

  it.each(routes)(
    '%s %s 拒绝未登录、客户、员工和失效管理员',
    async (method, path, name, data) => {
      for (const [token, status] of [
        [undefined, 401],
        ['invalid', 401],
        [userToken, 403],
        [employeeToken, 403],
        [disabledToken, 403],
        [absentAdminToken, 403],
      ] as const) {
        const req = request(app.getHttpServer())[method](path)
        if (token) req.set('Authorization', `Bearer ${token}`)
        if (data) req.send(data)
        await req.expect(status)
      }
      expect(adminService[name]).not.toHaveBeenCalled()
    },
  )

  it.each(['abc', '-1', '0', '1.5', '2147483648'])(
    '非法 ID %s 返回 400',
    async (id) => {
      await request(app.getHttpServer())
        .get(`/api/project/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400)
      expect(adminService.detail).not.toHaveBeenCalled()
    },
  )

  it('小程序原列表路径、分页字段和嵌套数据保持兼容', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/renovation-project/user?status=ALL&pageNum=1&pageSize=10')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
    expect(res.body).toMatchObject({
      code: 200,
      message: 'success',
      data: {
        list: [{ id: 1, userId: 7, quoteItems: [{ id: 1 }], plan: { id: 5 } }],
        total: 1,
        pageNum: 1,
        pageSize: 10,
        totalPage: 1,
      },
    })
    expect(findMany.mock.calls[0][0]).toMatchObject({
      where: { userId: 7 },
      omit: { remark: true, progress: true },
    })
    expect(res.body.data.list[0]).not.toHaveProperty('items')
  })
  it('小程序原详情继续返回 quoteItems 和 plan，其他客户无法读取', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/renovation-project/1')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
    expect(res.body.data).toMatchObject({
      quoteVersion: 1,
      quotedAmount: '2000',
      quoteItems: [{ id: 1 }],
      plan: { id: 5 },
    })
    await request(app.getHttpServer())
      .get('/api/renovation-project/1')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404)
  })
  it('小程序原确认参数不变，合同金额仍取报价并同步进度', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/renovation-project/1/confirm')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ quoteVersion: 1 })
      .expect(200)
    expect(res.body).toMatchObject({
      code: 200,
      message: 'success',
      data: { status: 'IN_SERVICE', contractAmount: '2000' },
    })
    expect(update.mock.calls[0][0]).toMatchObject({
      where: { id: 1, userId: 7, quoteVersion: 1 },
      data: {
        contractAmount: new Prisma.Decimal('2000'),
        progresses: { create: { status: 'IN_SERVICE' } },
      },
    })
    await request(app.getHttpServer())
      .patch('/api/renovation-project/1/confirm')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ quoteVersion: 2 })
      .expect(409)
  })
  it('管理员 ID 与客户 ID 重合也不能借用客户入口', async () => {
    await request(app.getHttpServer())
      .get('/api/renovation-project/user?status=ALL')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403)
    await request(app.getHttpServer())
      .get('/api/renovation-project/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403)
    await request(app.getHttpServer())
      .patch('/api/renovation-project/1/confirm')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quoteVersion: 1 })
      .expect(403)
    expect(findFirst).not.toHaveBeenCalled()
    expect(findMany).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })
})

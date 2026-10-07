import 'reflect-metadata'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import request from 'supertest'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'
import { OrderController } from '../order/order.controller'
import { OrderService } from '../order/order.service'
import { FeedbackController } from '../feedback/feedback.controller'
import { FeedbackService } from '../feedback/feedback.service'
import { AppointmentController } from '../appointment/appointment.controller'
import { AppointmentService } from '../appointment/appointment.service'
import { AppointmentRepository } from '../appointment/appointment.repository'
import { AdminProjectController } from '../renovation-project/admin-project.controller'
import { AdminProjectService } from '../renovation-project/admin-project.service'
import { PrismaService } from '../prisma/prisma.service'
import { ResponseInterceptor } from '../common/interceptors/response.interceptor'

describe('工作台及异常列表 HTTP', () => {
  let app: INestApplication
  const jwt = new JwtService({ secret: 'dashboard-test-only' })
  const admin = jwt.sign({ userId: 7, type: 'admin' })
  const customer = jwt.sign({ userId: 7, type: 'user' })
  const db = { admin: { findUnique: jest.fn() } }
  const dashboard = { overview: jest.fn().mockResolvedValue({ businessMetrics: [], businessStatuses: [], alerts: [] }) }
  const order = { findAll: jest.fn().mockResolvedValue({ list: [], total: 0 }) }
  const feedback = { findAll: jest.fn().mockResolvedValue({ list: [], total: 0 }) }
  const project = { list: jest.fn().mockResolvedValue({ list: [], total: 0 }) }
  const appointment = { GetPlanAll: jest.fn().mockResolvedValue([[], 0]) }
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [DashboardController, OrderController, FeedbackController, AppointmentController, AdminProjectController],
      providers: [
        { provide: JwtService, useValue: jwt }, { provide: PrismaService, useValue: db },
        { provide: DashboardService, useValue: dashboard }, { provide: OrderService, useValue: order },
        { provide: FeedbackService, useValue: feedback }, { provide: AdminProjectService, useValue: project },
        AppointmentService, { provide: AppointmentRepository, useValue: appointment },
      ],
    }).compile()
    app = module.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)))
    await app.init()
  })
  beforeEach(() => {
    jest.clearAllMocks()
    db.admin.findUnique.mockResolvedValue({ status: true })
  })
  afterAll(async () => { if (app) await app.close() })
  const paths = [
    '/dashboard/overview', '/order/all?alertType=overdue', '/feedback/all?alertType=overdue',
    '/project?alertType=overdue', '/appointment?pageNum=1&pageSize=10&alertType=unassigned',
  ]
  it.each(paths)('未登录拒绝 %s', async path => {
    await request(app.getHttpServer()).get('/api' + path).expect(401)
  })
  it.each(paths)('普通用户拒绝 %s', async path => {
    await request(app.getHttpServer()).get('/api' + path).auth(customer, { type: 'bearer' }).expect(403)
  })
  it.each(paths)('管理员正常访问 %s', async path => {
    await request(app.getHttpServer()).get('/api' + path).auth(admin, { type: 'bearer' }).expect(200)
  })
  it.each([null, { status: false }])('不存在或禁用管理员拒绝所有后台入口 %j', async account => {
    db.admin.findUnique.mockResolvedValue(account)
    for (const path of paths) await request(app.getHttpServer()).get('/api' + path).auth(admin, { type: 'bearer' }).expect(403)
  })
  it('汇总使用全局响应包装', async () => {
    const res = await request(app.getHttpServer()).get('/api/dashboard/overview').auth(admin, { type: 'bearer' }).expect(200)
    expect(res.body).toEqual({ code: 200, message: 'success', data: { businessMetrics: [], businessStatuses: [], alerts: [] } })
  })
  it.each(['/order/all', '/feedback/all', '/project', '/appointment?pageNum=1&pageSize=10'])('非法异常参数拒绝 %s', async path => {
    await request(app.getHttpServer()).get('/api' + path + (path.includes('?') ? '&' : '?') + 'alertType=invalid')
      .auth(admin, { type: 'bearer' }).expect(400)
  })
  it('预约用户无异常参数仍只能查询本人', async () => {
    await request(app.getHttpServer()).get('/api/appointment?pageNum=1&pageSize=10').auth(customer, { type: 'bearer' }).expect(200)
    expect(appointment.GetPlanAll).toHaveBeenCalledWith(7, 1, 10, undefined, undefined)
  })
  it('mine接口不接受后台异常参数', async () => {
    await request(app.getHttpServer()).get('/api/appointment/mine?pageNum=1&pageSize=10&alertType=unassigned')
      .auth(customer, { type: 'bearer' }).expect(400)
  })
})

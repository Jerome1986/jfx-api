import { INestApplication } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import request from 'supertest'
import { OrderController } from './order.controller'
import { OrderRepository } from './order.repository'
import { OrderService } from './order.service'
import { PrismaService } from '../prisma/prisma.service'
import { ResponseInterceptor } from '../common/interceptors/response.interceptor'

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }))
jest.mock('./order-preparation.service', () => ({ OrderPreparationService: class {} }))
jest.mock('../payment/payment.service', () => ({ PaymentService: class {} }))
jest.mock('../../generated/prisma/client', () => ({ Prisma: {} }))

describe('User order detail HTTP', () => {
  let app: INestApplication
  const jwt = new JwtService({ secret: 'order-detail-test-only' })
  const token = jwt.sign({ userId: 7, type: 'user', role: 'CUSTOMER' })
  const order = {
    id: 15, userId: 7, orderNo: 'test-order',
    appointmentDate: null, timeSlot: null,
    createdAt: new Date('2026-09-20T09:20:50.915Z'),
    items: [{ id: 1, productName: 'Snapshot product', quantity: 2 }],
    installation: null,
  }
  const findFirst = jest.fn(async ({ where }) =>
    where.id === order.id && where.userId === order.userId ? order : null,
  )

  beforeAll(async () => {
    const repo = new OrderRepository({ productOrder: { findFirst } } as unknown as PrismaService)
    const service = new OrderService(repo, {} as never, {} as never, {} as never)
    const module = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        { provide: OrderService, useValue: service },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile()
    app = module.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)))
    await app.init()
  })
  beforeEach(() => findFirst.mockClear())
  afterAll(async () => { await app?.close() })

  it('returns the owner order, snapshots, nullable installation and ISO date', async () => {
    const res = await request(app.getHttpServer()).get('/api/order/detail/15')
      .set('Authorization', 'Bearer ' + token).expect(200)
    expect(res.body).toEqual({ code: 200, message: 'success', data: {
      ...order, createdAt: order.createdAt.toISOString(),
    } })
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 15, userId: 7 }, include: { items: true, installation: true },
    })
  })

  it('returns 404 for another user even if the query supplies the owner userId', async () => {
    const other = jwt.sign({ userId: 8, type: 'user', role: 'CUSTOMER' })
    await request(app.getHttpServer()).get('/api/order/detail/15?userId=7')
      .set('Authorization', 'Bearer ' + other).expect(404)
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 15, userId: 8 } }))
  })

  it('returns 404 for a missing order', async () => {
    await request(app.getHttpServer()).get('/api/order/detail/999')
      .set('Authorization', 'Bearer ' + token).expect(404)
  })

  it.each(['abc', '1.5', '0', '-1', '2147483648', '9007199254740993'])('rejects invalid ID %s before querying', async id => {
    await request(app.getHttpServer()).get('/api/order/detail/' + id)
      .set('Authorization', 'Bearer ' + token).expect(400)
    expect(findFirst).not.toHaveBeenCalled()
  })

  it.each([undefined, 'Bearer invalid-token'])('rejects unauthenticated requests %s', async authorization => {
    const req = request(app.getHttpServer()).get('/api/order/detail/15')
    if (authorization) req.set('Authorization', authorization)
    await req.expect(401)
    expect(findFirst).not.toHaveBeenCalled()
  })
})

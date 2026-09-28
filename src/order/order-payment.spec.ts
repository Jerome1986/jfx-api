import { ConflictException, INestApplication, ServiceUnavailableException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import request from 'supertest'
import { Prisma } from '../../generated/prisma/client'
import { OrderController } from './order.controller'
import { OrderRepository } from './order.repository'
import { OrderService } from './order.service'
import { PrismaService } from '../prisma/prisma.service'
import { ResponseInterceptor } from '../common/interceptors/response.interceptor'

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }))
jest.mock('./order-preparation.service', () => ({ OrderPreparationService: class {} }))
jest.mock('../payment/payment.service', () => ({ PaymentService: class {} }))
jest.mock('../../generated/prisma/client', () => ({
  Prisma: { Decimal: jest.requireActual('@prisma/client/runtime/client').Decimal },
}))

describe('Existing order payment HTTP and service', () => {
  let app: INestApplication
  let service: OrderService
  const actor = { userId: 7, type: 'user' as const }
  const jwt = new JwtService({ secret: 'order-payment-test-only' })
  const token = jwt.sign({ ...actor, role: 'CUSTOMER' })
  const params = {
    timeStamp: '1790000000', nonceStr: 'nonce', packageValue: 'prepay_id=test',
    signType: 'RSA', paySign: 'signature',
  }
  const createdAt = new Date()
  const makeOrder = () => ({
    createdAt,
    id: 15, userId: 7, orderNo: 'existing-order', payableAmount: new Prisma.Decimal('123.45'),
    status: 'PENDING_PAYMENT', paymentStatus: 'UNPAID',
    paymentNo: null as string | null, paidAt: null as Date | null,
    user: { status: true, openid: 'owner-openid' as string | null },
  })
  let order: ReturnType<typeof makeOrder>
  const findFirst = jest.fn()
  const wxPay = jest.fn()
  const writes = {
    create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), delete: jest.fn(),
  }
  const prisma = {
    productOrder: { findFirst, ...writes },
    product: { update: jest.fn(), updateMany: jest.fn() },
    user: { update: jest.fn() }, userCoupon: { updateMany: jest.fn() },
    stockLog: { create: jest.fn() }, pointLog: { create: jest.fn() },
    $transaction: jest.fn(),
  }
  const prepare = jest.fn()

  beforeAll(async () => {
    service = new OrderService(
      new OrderRepository(prisma as unknown as PrismaService),
      { prepare } as never, { wxPay } as never, prisma as unknown as PrismaService,
    )
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
  beforeEach(() => {
    jest.clearAllMocks()
    order = makeOrder()
    findFirst.mockReset().mockImplementation(async ({ where }) =>
      where.id === order.id && where.userId === order.userId ? order : null,
    )
    wxPay.mockReset().mockResolvedValue(params)
  })
  afterEach(() => {
    expect(prepare).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
    for (const model of Object.values(prisma)) {
      if (typeof model === 'object') {
        for (const method of Object.values(model)) {
          if (method !== findFirst) expect(method).not.toHaveBeenCalled()
        }
      }
    }
  })
  afterAll(async () => { await app?.close() })
  const pay = (id: string | number = 15, auth = token) =>
    request(app.getHttpServer()).post('/api/order/' + id + '/pay')
      .set('Authorization', 'Bearer ' + auth)

  it('returns HTTP 200 and the existing first-payment fields using only trusted order data', async () => {
    const res = await pay().send({ userId: 9, openid: 'attacker', amount: 999, orderNo: 'other' }).expect(200)
    expect(res.body).toEqual({ code: 200, message: 'success', data: { ...params, orderId: 15 } })
    expect(wxPay).toHaveBeenCalledWith('商品订单', 'existing-order', 'owner-openid', 12345, new Date(createdAt.getTime() + 30 * 60 * 1000))
    expect(findFirst).toHaveBeenCalledTimes(2)
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 15, userId: 7 },
      select: {
        id: true, orderNo: true, payableAmount: true, createdAt: true, status: true,
        paymentStatus: true, paymentNo: true, paidAt: true,
        user: { select: { status: true, openid: true } },
      },
    })
    expect(order).toEqual(makeOrder())
  })
  it.each(['abc', '1.5', '0', '-1', '2147483648', '9007199254740993'])('rejects invalid ID %s', async id => {
    await pay(id).expect(400)
    expect(findFirst).not.toHaveBeenCalled()
    expect(wxPay).not.toHaveBeenCalled()
  })
  it.each([undefined, 'invalid-token'])('requires authentication (%s)', async auth => {
    const req = request(app.getHttpServer()).post('/api/order/15/pay')
    if (auth) req.set('Authorization', 'Bearer ' + auth)
    await req.expect(401)
    expect(findFirst).not.toHaveBeenCalled()
    expect(wxPay).not.toHaveBeenCalled()
  })
  it('rejects an admin even when its numeric ID matches the owner', async () => {
    await pay(15, jwt.sign({ userId: 7, type: 'admin' })).expect(403)
    expect(findFirst).not.toHaveBeenCalled()
    expect(wxPay).not.toHaveBeenCalled()
  })
  it('hides orders owned by another user', async () => {
    await pay(15, jwt.sign({ userId: 8, type: 'user' })).send({ userId: 7 }).expect(404)
    expect(wxPay).not.toHaveBeenCalled()
  })
  it('returns 404 for a missing order', async () => {
    await pay(999).expect(404)
    expect(wxPay).not.toHaveBeenCalled()
  })
  it('rejects disabled users', async () => {
    order.user.status = false
    await pay().expect(403)
    expect(wxPay).not.toHaveBeenCalled()
  })
  it.each([null, '', '   '])('rejects missing WeChat identity (%s)', async openid => {
    order.user.openid = openid
    await pay().expect(400)
    expect(wxPay).not.toHaveBeenCalled()
  })
  it.each(['PENDING_INSTALLATION', 'IN_SERVICE', 'PENDING_CONFIRMATION', 'COMPLETED', 'CANCELED', 'REFUNDING', 'REFUNDED'])(
    'rejects business status %s', async status => {
      order.status = status
      await pay().expect(409)
      expect(wxPay).not.toHaveBeenCalled()
    },
  )
  it.each(['PAID', 'CLOSED', 'REFUNDING', 'REFUNDED'])('rejects payment status %s', async status => {
    order.paymentStatus = status
    await pay().expect(409)
    expect(wxPay).not.toHaveBeenCalled()
  })
  it.each(['paymentNo', 'paidAt'])('rejects existing %s even if statuses still say unpaid', async field => {
    if (field === 'paymentNo') order.paymentNo = 'wx-transaction'
    else order.paidAt = new Date()
    await pay().expect(409)
    expect(wxPay).not.toHaveBeenCalled()
  })
  it('supports sequential and concurrent retries on the original order without writing resources', async () => {
    await service.pay(15, actor)
    await service.pay(15, actor)
    await Promise.all([service.pay(15, actor), service.pay(15, actor)])
    expect(wxPay).toHaveBeenCalledTimes(4)
    for (const args of wxPay.mock.calls) {
      expect(args).toEqual(['商品订单', 'existing-order', 'owner-openid', 12345, new Date(createdAt.getTime() + 30 * 60 * 1000)])
    }
    expect(order).toEqual(makeOrder())
  })
  it.each(['CANCELED', 'PENDING_INSTALLATION'])('does not return parameters if state becomes %s during WeChat request', async status => {
    let release!: (value: typeof params) => void
    let started!: () => void
    const called = new Promise<void>(resolve => { started = resolve })
    wxPay.mockImplementation(() => {
      started()
      return new Promise(resolve => { release = resolve })
    })
    const pending = service.pay(15, actor)
    const rejection = expect(pending).rejects.toBeInstanceOf(ConflictException)
    await called
    order = { ...order, status, paymentStatus: status === 'CANCELED' ? 'CLOSED' : 'PAID' }
    release(params)
    await rejection
    expect(findFirst).toHaveBeenCalledTimes(2)
  })
  it.each([new ConflictException('已支付'), new ServiceUnavailableException('超时')])(
    'propagates payment errors without changing the order', async error => {
      wxPay.mockRejectedValue(error)
      await pay().expect(error.getStatus())
      expect(findFirst).toHaveBeenCalledTimes(1)
      expect(order).toEqual(makeOrder())
    },
  )
  it('allows another attempt after a timeout', async () => {
    wxPay.mockRejectedValueOnce(new ServiceUnavailableException('超时'))
    await pay().expect(503)
    await pay().expect(200)
    expect(wxPay).toHaveBeenCalledTimes(2)
    expect(order).toEqual(makeOrder())
  })
})

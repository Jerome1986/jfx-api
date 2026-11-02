import 'reflect-metadata'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { JwtModule, JwtService } from '@nestjs/jwt'
import request from 'supertest'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import { AddressController } from './address.controller'
import { AddressService } from './address.service'
import { AddressRepository } from './address.repository'
import { PrismaService } from '../prisma/prisma.service'

describe('地址接口用户隔离', () => {
  let app: INestApplication
  let jwt: JwtService
  let addresses: any[]
  const body = { contactName: '张三', phone: '13800000000', address: '测试地址' }
  const missing = () => new PrismaClientKnownRequestError('Record not found', {
    code: 'P2025', clientVersion: '7.9.1',
  })
  const prisma = {
    user: { findUnique: jest.fn(async ({ where }) => ({ status: where.id !== 3 })) },
    address: {
      findMany: jest.fn(async ({ where }) => addresses.filter(row => row.userId === where.userId)),
      findUnique: jest.fn(async ({ where }) => addresses.find(row => row.id === where.id && row.userId === where.userId) ?? null),
      create: jest.fn(async ({ data }) => {
        const row = { ...data, id: 30 }
        addresses.push(row)
        return row
      }),
      update: jest.fn(async ({ where, data }) => {
        const row = addresses.find(row => row.id === where.id && row.userId === where.userId)
        if (!row) throw missing()
        Object.assign(row, data)
        return row
      }),
      delete: jest.fn(async ({ where }) => {
        const index = addresses.findIndex(row => row.id === where.id && row.userId === where.userId)
        if (index < 0) throw missing()
        return addresses.splice(index, 1)[0]
      }),
    },
  }
  const token = (userId = 1, type = 'user', role = 'CUSTOMER') =>
    jwt.sign({ userId, type, role })
  const call = (method: string, path: string, auth?: string, data?: object) => {
    const req = request(app.getHttpServer())[method](`/api/address${path}`)
    if (auth) req.set('Authorization', `Bearer ${auth}`)
    if (data) req.send(data)
    return req
  }
  const routes = [
    ['get', ''], ['get', '/10'], ['post', ''], ['patch', '/10'], ['delete', '/10'],
  ]

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'address-isolation-test-secret' })],
      controllers: [AddressController],
      providers: [AddressService, AddressRepository, { provide: PrismaService, useValue: prisma }],
    }).compile()
    app = module.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    await app.init()
    jwt = module.get(JwtService)
  })
  beforeEach(() => {
    addresses = [{ ...body, id: 10, userId: 1 }, { ...body, id: 20, userId: 2 }]
    jest.clearAllMocks()
  })
  afterAll(async () => { await app.close() })

  it.each(routes)('%s %s 拒绝未登录和无效 Token', async (method, path) => {
    await call(method, path, undefined, body).expect(401)
    await call(method, path, 'invalid-token', body).expect(401)
    await call(method, path, jwt.sign({ userId: 1, type: 'user', role: 'CUSTOMER' }, { expiresIn: -1 }), body).expect(401)
  })
  it.each(routes)('%s %s 拒绝管理员身份和禁用账号', async (method, path) => {
    await call(method, path, token(1, 'admin', 'SUPER_ADMIN'), body).expect(403)
    await call(method, path, token(3), body).expect(403)
    expect(prisma.address.findMany).not.toHaveBeenCalled()
    expect(prisma.address.findUnique).not.toHaveBeenCalled()
    expect(prisma.address.create).not.toHaveBeenCalled()
    expect(prisma.address.update).not.toHaveBeenCalled()
    expect(prisma.address.delete).not.toHaveBeenCalled()
  })
  it('列表仅返回本人地址，查询参数不能改变归属', async () => {
    const first = await call('get', '?userId=2', token()).expect(200)
    expect(first.body.map(row => row.id)).toEqual([10])
    const second = await call('get', '', token(2)).expect(200)
    expect(second.body.map(row => row.id)).toEqual([20])
  })
  it.each(['get', 'patch', 'delete'])('%s 拒绝访问他人地址和不存在的地址', async method => {
    await call(method, '/20', token(), method === 'patch' ? { address: '越权修改' } : undefined).expect(404)
    await call(method, '/999', token(), method === 'patch' ? { address: '越权修改' } : undefined).expect(404)
    expect(addresses).toHaveLength(2)
    expect(addresses[1]).toMatchObject({ id: 20, userId: 2, address: body.address })
  })
  it('新增地址从 Token 确定所属用户', async () => {
    const result = await call('post', '', token(2), body).expect(201)
    expect(result.body.userId).toBe(2)
  })
  it.each(['post', 'patch'])('%s 拒绝伪造 userId 或嵌套用户关联', async method => {
    const path = method === 'post' ? '' : '/10'
    await call(method, path, token(), { ...body, userId: 2 }).expect(400)
    await call(method, path, token(), { ...body, user: { connect: { id: 2 } } }).expect(400)
    expect(prisma.address.create).not.toHaveBeenCalled()
    expect(prisma.address.update).not.toHaveBeenCalled()
  })
  it('允许查看、修改和删除本人地址', async () => {
    await call('get', '/10', token()).expect(200)
    const result = await call('patch', '/10', token(), { address: '新地址' }).expect(200)
    expect(result.body).toMatchObject({ userId: 1, address: '新地址' })
    await call('delete', '/10', token()).expect(200)
    expect(addresses.map(row => row.id)).toEqual([20])
  })
})

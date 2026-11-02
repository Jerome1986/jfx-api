import 'reflect-metadata'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { JwtModule, JwtService } from '@nestjs/jwt'
import request from 'supertest'
import { UserController } from './user.controller'
import { UserService } from './user.service'
import { UserRepository } from './user.repository'
import { FavoriteController } from '../favorite/favorite.controller'
import { FavoriteService } from '../favorite/favorite.service'
import { FavoriteRepository } from '../favorite/favorite.repository'
import { PrismaService } from '../prisma/prisma.service'
import { WxUtil } from '../utils/wx.util'

describe('用户资料与收藏访问权限', () => {
  let app: INestApplication
  let jwt: JwtService
  let favorites: any[]
  const prisma = {
    user: {
      findUnique: jest.fn(async ({ where, select }) => {
        if (where.id === 99) return null
        const row = {
          id: where.id, mobile: `1380000000${where.id}`, openid: `private-${where.id}`,
          status: where.id !== 3, points: 10, userCoupons: [],
          _count: { appointments: 1, favorites: 1, userCoupons: 0 },
        }
        return Object.fromEntries(Object.keys(select).map(key => [key, row[key]]))
      }),
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
    },
    admin: { findUnique: jest.fn(async ({ where }) => ({ status: where.id === 1 })) },
    favorite: {
      findMany: jest.fn(async ({ where }) => favorites.filter(row => row.userId === where.userId)),
      findUnique: jest.fn(async ({ where }) => favorites.find(row =>
        row.userId === where.userId_caseId.userId && row.caseId === where.userId_caseId.caseId)),
      create: jest.fn(async ({ data }) => {
        const row = { id: 30, ...data }
        favorites.push(row)
        return row
      }),
      delete: jest.fn(async ({ where }) => {
        const index = favorites.findIndex(row => row.userId === where.userId_caseId.userId && row.caseId === where.userId_caseId.caseId)
        return favorites.splice(index, 1)[0]
      }),
    },
  }
  const token = (userId = 1, type = 'user') => jwt.sign({ userId, type, role: type === 'user' ? 'CUSTOMER' : 'SUPER_ADMIN' })
  const call = (method: string, path: string, auth?: string, body?: object) => {
    const req = request(app.getHttpServer())[method](`/api${path}`)
    if (auth) req.set('Authorization', `Bearer ${auth}`)
    if (body) req.send(body)
    return req
  }
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'user-access-test-secret' })],
      controllers: [UserController, FavoriteController],
      providers: [UserService, UserRepository, FavoriteService, FavoriteRepository,
        { provide: PrismaService, useValue: prisma }, { provide: WxUtil, useValue: {} }],
    }).compile()
    app = module.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    await app.init()
    jwt = module.get(JwtService)
  })
  beforeEach(() => {
    favorites = [
      { id: 10, userId: 1, caseId: 5, case: { title: '本人收藏' } },
      { id: 20, userId: 2, caseId: 6, case: { title: '他人收藏' } },
    ]
    jest.clearAllMocks()
  })
  afterAll(async () => { await app.close() })

  it.each([
    ['get', '/user/2'], ['get', '/user/summary/2'], ['get', '/favorite/user/2'],
    ['post', '/favorite/toggle'], ['get', '/user'], ['put', '/user/2'], ['delete', '/user/2'],
  ])('%s %s 拒绝未登录、无效和过期 Token', async (method, path) => {
    await call(method, path).expect(401)
    await call(method, path, 'invalid').expect(401)
    await call(method, path, jwt.sign({ userId: 1, type: 'user' }, { expiresIn: -1 })).expect(401)
  })
  it.each(['/user/2', '/user/summary/2', '/favorite/user/2'])('%s 拒绝读取其他用户数据', async path => {
    await call('get', path, token()).expect(403)
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
    expect(prisma.favorite.findMany).not.toHaveBeenCalled()
  })
  it.each(['/user/3', '/user/summary/3', '/favorite/user/3'])('%s 拒绝禁用账号', async path => {
    await call('get', path, token(3)).expect(403)
  })
  it.each(['/user/99', '/user/summary/99', '/favorite/user/99'])('%s 拒绝已不存在的账号', async path => {
    await call('get', path, token(99)).expect(403)
  })
  it('允许查看本人资料和汇总，资料不包含 openid', async () => {
    const detail = await call('get', '/user/1', token()).expect(200)
    expect(detail.body).toMatchObject({ id: 1, mobile: '13800000001' })
    expect(detail.body).not.toHaveProperty('openid')
    const summary = await call('get', '/user/summary/1', token()).expect(200)
    expect(summary.body).toMatchObject({ points: 10, favoriteCount: 1 })
  })
  it('启用管理员可查询用户资料，禁用管理员不可查询', async () => {
    await call('get', '/user/2', token(1, 'admin')).expect(200)
    await call('get', '/user/summary/2', token(1, 'admin')).expect(200)
    await call('get', '/user/2', token(3, 'admin')).expect(403)
    await call('get', '/user/summary/2', token(3, 'admin')).expect(403)
  })
  it.each([['get', '/user'], ['put', '/user/2'], ['delete', '/user/2']])('%s %s 仅限管理员', async (method, path) => {
    await call(method, path, token(), {}).expect(403)
    await call(method, path, token(3, 'admin'), {}).expect(403)
  })
  it('非空收藏列表仅包含本人数据', async () => {
    const first = await call('get', '/favorite/user/1', token()).expect(200)
    expect(first.body.map(row => row.id)).toEqual([10])
    const second = await call('get', '/favorite/user/2', token(2)).expect(200)
    expect(second.body.map(row => row.id)).toEqual([20])
  })
  it('管理员不能使用重合 ID 访问用户收藏', async () => {
    await call('get', '/favorite/user/1', token(1, 'admin')).expect(403)
    await call('post', '/favorite/toggle', token(1, 'admin'), { caseId: 5 }).expect(403)
  })
  it('拒绝伪造收藏归属和禁用账号写入', async () => {
    await call('post', '/favorite/toggle', token(), { userId: 2, caseId: 6 }).expect(403)
    await call('post', '/favorite/toggle', token(3), { caseId: 6 }).expect(403)
    expect(prisma.favorite.findUnique).not.toHaveBeenCalled()
    expect(prisma.favorite.create).not.toHaveBeenCalled()
    expect(prisma.favorite.delete).not.toHaveBeenCalled()
  })
  it('收藏新增和取消均绑定 Token 用户，兼容传本人 userId', async () => {
    const added = await call('post', '/favorite/toggle', token(), { caseId: 9 }).expect(201)
    expect(added.body.favorite.userId).toBe(1)
    const removed = await call('post', '/favorite/toggle', token(), { userId: 1, caseId: 9 }).expect(201)
    expect(removed.body.favorited).toBe(false)
    expect(favorites.find(row => row.id === 20)).toBeDefined()
  })
})

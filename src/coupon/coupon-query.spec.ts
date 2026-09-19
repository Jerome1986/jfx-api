import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { QueryCouponDto } from './dto/query-coupon.dto'
import { CouponService } from './coupon.service'
import { CouponRepository } from './coupon.repository'
import { PrismaService } from '../prisma/prisma.service'

// 单元测试隔离数据库客户端，查询行为由下方的仓储替身验证。
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }))
jest.mock('../../generated/prisma/client', () => ({
  Prisma: { TransactionIsolationLevel: { RepeatableRead: 'RepeatableRead' } },
}))

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
})
const parse = (query: unknown): Promise<QueryCouponDto> =>
  pipe.transform(query, { type: 'query', metatype: QueryCouponDto })

describe('优惠券列表', () => {
  it.each([
    { status: 'UNKNOWN' },
    { status: 'NOT_STARTED' },
    { status: 'ACTIVE' },
    { status: 'ENDED' },
    { status: ['PUBLISHED', 'DRAFT'] },
    { keyword: ['a', 'b'] },
    { pageNum: '0' },
    { pageNum: '1.5' },
    { pageNum: '2147483648' },
    { pageSize: '101' },
    { pageSize: '-1' },
    { pageSize: '' },
    { pageSize: '1e2' },
  ])('拒绝非法查询参数 %p', async (query) => {
    await expect(parse(query)).rejects.toThrow()
  })

  function setup(list: unknown[] = [], total = 0) {
    const db = {
      coupon: {
        findMany: jest.fn().mockResolvedValue(list),
        count: jest.fn().mockResolvedValue(total),
      },
      $transaction: jest.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
    }
    const repo = new CouponRepository(db as unknown as PrismaService)
    return { db, service: new CouponService(repo) }
  }

  it('解析组合筛选并返回分页，列表与总数使用相同条件', async () => {
    const { db, service } = setup([{ id: 1 }], 21)
    const query = await parse({
      keyword: ' 满减50%_ ',
      status: 'PUBLISHED',
      pageNum: '2',
      pageSize: '10',
    })
    await expect(service.findAll(query)).resolves.toEqual({
      list: [{ id: 1 }], total: 21, pageNum: 2, pageSize: 10, totalPage: 3,
    })
    const where = { name: { contains: '满减50\\%\\_' }, status: 'PUBLISHED' }
    expect(db.coupon.findMany).toHaveBeenCalledWith({
      where,
      skip: 10,
      take: 10,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    expect(db.coupon.count).toHaveBeenCalledWith({ where })
  })

  it('默认分页，空白关键字不筛选，无结果返回空列表', async () => {
    const { db, service } = setup()
    await expect(service.findAll(await parse({ keyword: '  ' }))).resolves.toEqual({
      list: [], total: 0, pageNum: 1, pageSize: 10, totalPage: 0,
    })
    expect(db.coupon.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {}, skip: 0, take: 10,
    }))
  })

  it('超出末页时保留总数，只传每页数量时使用默认页码', async () => {
    const { service } = setup([], 21)
    await expect(service.findAll(await parse({ pageNum: '4' }))).resolves.toMatchObject({
      list: [], total: 21, pageNum: 4, pageSize: 10, totalPage: 3,
    })
    await expect(service.findAll(await parse({ pageSize: '5' }))).resolves.toMatchObject({
      pageNum: 1, pageSize: 5, totalPage: 5,
    })
  })
})

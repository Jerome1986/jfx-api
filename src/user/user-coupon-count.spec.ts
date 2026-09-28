import { UserRepository } from './user.repository'

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }))

describe('用户可用优惠券统计', () => {
  const now = new Date('2026-09-28T00:00:00Z')
  const expectedWhere = {
    status: 'AVAILABLE', orderId: null, expiresAt: { gt: now },
    coupon: { validFrom: { lte: now }, status: { not: 'DRAFT' } },
  }
  beforeEach(() => { jest.useFakeTimers().setSystemTime(now) })
  afterEach(() => jest.useRealTimers())

  it('详情保留全部券，couponCount 与汇总均统计当前可用券', async () => {
    const records = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]
    const findUnique = jest.fn().mockResolvedValue({ id: 7, points: 8, userCoupons: records, _count: { appointments: 1, favorites: 3, userCoupons: 2 } })
    const repo = new UserRepository({ user: { findUnique } } as any)
    const detail = await repo.findOne(7)
    const summary = await repo.summary(7)
    expect(detail?.userCoupons).toEqual(records)
    expect(detail?.couponCount).toBe(2)
    expect(summary?.couponCount).toBe(2)
    for (const [query] of findUnique.mock.calls) {
      expect(query.where).toEqual({ id: 7 })
      expect(query.select._count.select.userCoupons.where).toEqual(expectedWhere)
    }
    expect(findUnique.mock.calls[0][0].select.userCoupons).not.toHaveProperty('where')
    expect(findUnique.mock.calls[1][0].select._count.select.appointments.where).toEqual({ status: { notIn: ['COMPLETED', 'CANCELED'] } })
  })

  it('查询条件不排除停用模板，也不使用模板截止时间缩短已领券有效期', async () => {
    const findUnique = jest.fn().mockResolvedValue({ points: 0, _count: { appointments: 0, favorites: 0, userCoupons: 0 } })
    const repo = new UserRepository({ user: { findUnique } } as any)
    expect((await repo.summary(7))?.couponCount).toBe(0)
    const where = findUnique.mock.calls[0][0].select._count.select.userCoupons.where
    expect(where.coupon.status).toEqual({ not: 'DRAFT' })
    expect(where.coupon).not.toHaveProperty('validTo')
  })

  it('用户不存在仍返回 null', async () => {
    const repo = new UserRepository({ user: { findUnique: jest.fn().mockResolvedValue(null) } } as any)
    expect(await repo.findOne(7)).toBeNull()
    expect(await repo.summary(7)).toBeNull()
  })
})

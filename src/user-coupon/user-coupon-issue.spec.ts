import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { UserCouponService } from './user-coupon.service'
import { CouponRepository } from '../coupon/coupon.repository'
import { UserCouponRepository } from './user-coupon.repository'
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }))
jest.mock('../../generated/prisma/client', () => ({ Prisma: { TransactionIsolationLevel: { ReadCommitted: 'ReadCommitted' } } }))

describe('发放优惠券数量更新', () => {
  let tx: any, prisma: any, userRepo: any, service: UserCouponService
  const expiresAt = new Date('2027-01-01')
  beforeEach(() => {
    tx = {
      coupon: { findFirst: jest.fn().mockResolvedValue({ id: 1, totalQuantity: 10, issuedQuantity: 2, validTo: expiresAt }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      userCoupon: { create: jest.fn().mockResolvedValue({ id: 3 }) },
    }
    prisma = { $transaction: jest.fn(fn => fn(tx)) }
    userRepo = { findById: jest.fn().mockResolvedValue({ status: true }) }
    service = new UserCouponService(new UserCouponRepository(prisma), new CouponRepository(prisma), userRepo, prisma)
  })
  it('同一事务中增加已发行数量并创建用户券，不修改发行总量', async () => {
    await expect(service.sendCouponByUser({ userId: 7, couponId: 1 })).resolves.toEqual({ id: 3 })
    expect(tx.coupon.updateMany).toHaveBeenCalledWith({
      where: { id: 1, totalQuantity: 10, issuedQuantity: { lt: 10 } },
      data: { issuedQuantity: { increment: 1 } },
    })
    expect(tx.userCoupon.create).toHaveBeenCalledWith({ data: { userId: 7, couponId: 1, expiresAt } })
    expect(userRepo.findById).toHaveBeenCalledWith(7, tx)
  })
  it('达到发行上限时不发券', async () => {
    tx.coupon.findFirst.mockResolvedValue({ totalQuantity: 10, issuedQuantity: 10 })
    await expect(service.sendCouponByUser({ userId: 7, couponId: 1 })).rejects.toThrow(ConflictException)
    expect(tx.coupon.updateMany).not.toHaveBeenCalled()
    expect(tx.userCoupon.create).not.toHaveBeenCalled()
  })
  it('并发请求耗尽额度时不发券', async () => {
    tx.coupon.updateMany.mockResolvedValue({ count: 0 })
    await expect(service.sendCouponByUser({ userId: 7, couponId: 1 })).rejects.toThrow(ConflictException)
    expect(tx.userCoupon.create).not.toHaveBeenCalled()
  })
  it('创建失败时向事务传播错误', async () => {
    tx.userCoupon.create.mockRejectedValue(new Error('写入失败'))
    await expect(service.sendCouponByUser({ userId: 7, couponId: 1 })).rejects.toThrow('写入失败')
  })
  it('用户禁用时不更新数量', async () => {
    userRepo.findById.mockResolvedValue({ status: false })
    await expect(service.sendCouponByUser({ userId: 7, couponId: 1 })).rejects.toThrow(ForbiddenException)
    expect(tx.coupon.updateMany).not.toHaveBeenCalled()
  })
  it('模板不存在时不发券', async () => {
    tx.coupon.findFirst.mockResolvedValue(null)
    await expect(service.sendCouponByUser({ userId: 7, couponId: 1 })).rejects.toThrow(NotFoundException)
    expect(tx.userCoupon.create).not.toHaveBeenCalled()
  })
})

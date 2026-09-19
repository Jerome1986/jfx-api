import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import { CouponService } from './coupon.service'
import { CouponRepository } from './coupon.repository'

jest.mock('./coupon.repository', () => ({ CouponRepository: class {} }))

describe('删除优惠券模板', () => {
  const repo = { remove: jest.fn(), findOne: jest.fn() }
  const service = new CouponService(repo as unknown as CouponRepository)
  const dbError = (code: string) =>
    new PrismaClientKnownRequestError('delete failed', { code, clientVersion: '7.9.1' })

  beforeEach(() => jest.resetAllMocks())

  it('返回删除的模板', async () => {
    repo.remove.mockResolvedValue({ id: 1 })
    await expect(service.remove(1)).resolves.toEqual({ id: 1 })
  })

  it.each([0, -1, 1.5, NaN, 2147483648])('拒绝非法ID %s', async (id) => {
    await expect(service.remove(id)).rejects.toBeInstanceOf(BadRequestException)
    expect(repo.remove).not.toHaveBeenCalled()
  })

  it('模板不存在返回404', async () => {
    repo.remove.mockRejectedValue(dbError('P2025'))
    repo.findOne.mockResolvedValue(null)
    await expect(service.remove(1)).rejects.toBeInstanceOf(NotFoundException)
  })

  it('已发放模板返回409', async () => {
    repo.remove.mockRejectedValue(dbError('P2025'))
    repo.findOne.mockResolvedValue({ id: 1, issuedQuantity: 1 })
    await expect(service.remove(1)).rejects.toBeInstanceOf(ConflictException)
  })

  it('并发发放触发外键约束时返回409', async () => {
    repo.remove.mockRejectedValue(dbError('P2003'))
    await expect(service.remove(1)).rejects.toBeInstanceOf(ConflictException)
  })

  it('保留未知数据库错误', async () => {
    const error = new Error('connection failed')
    repo.remove.mockRejectedValue(error)
    await expect(service.remove(1)).rejects.toBe(error)
  })
})

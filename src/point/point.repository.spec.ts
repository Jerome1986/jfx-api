import { ConflictException } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { PointRepository } from './point.repository'
import { QueryPointAccountsDto, QueryPointFlowsDto } from './dto/query-point.dto'

describe('后台积分仓储', () => {
  const dto = { direction: 'increase' as const, amount: 100, reason: '补偿', requestId: 'request-1' }
  const record = { id: 1, userId: 2, operatorId: 7, flowType: 'MANUAL_INCREASE', amount: 100, description: '补偿' }
  let db: any, tx: any, repo: PointRepository
  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 2, points: 120, pointDebt: 30, totalPointsEarned: 500, totalPointsUsed: 380, status: true }]),
      user: { update: jest.fn() },
      admin: { findUnique: jest.fn().mockResolvedValue({ username: '管理员', status: true }) },
      pointRecord: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(record) },
    }
    db = {
      $transaction: jest.fn(arg => typeof arg === 'function' ? arg(tx) : Promise.all(arg)),
      user: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      pointRecord: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    }
    repo = new PointRepository(db)
  })
  it('事务内更新账户与流水，返回原始流水', async () => {
    await expect(repo.adjust(2, dto, 7)).resolves.toBe(record)
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'ReadCommitted' })
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 2 }, data: {
      points: 190, pointDebt: 0, totalPointsEarned: 600, totalPointsUsed: 380,
    } })
    expect(tx.pointRecord.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      requestId: 'request-1', operatorId: 7, operator: '管理员', amount: 100,
      balanceBefore: 120, balance: 190, debtBefore: 30, debtAfter: 0,
    }) })
  })
  it('同一个请求重放不写账户或流水', async () => {
    tx.pointRecord.findUnique.mockResolvedValue(record)
    await expect(repo.adjust(2, dto, 7)).resolves.toBe(record)
    expect(tx.user.update).not.toHaveBeenCalled()
    expect(tx.pointRecord.create).not.toHaveBeenCalled()
  })
  it.each([
    { amount: 101 }, { direction: 'decrease' }, { reason: '其他' },
  ])('同一个请求改参数返回409 %j', async patch => {
    tx.pointRecord.findUnique.mockResolvedValue(record)
    await expect(repo.adjust(2, { ...dto, ...patch } as typeof dto, 7)).rejects.toBeInstanceOf(ConflictException)
    expect(tx.user.update).not.toHaveBeenCalled()
  })
  it('跨用户或跨管理员复用请求被拒绝', async () => {
    tx.pointRecord.findUnique.mockResolvedValue(record)
    await expect(repo.adjust(3, dto, 7)).rejects.toBeInstanceOf(ConflictException)
    await expect(repo.adjust(2, dto, 8)).rejects.toBeInstanceOf(ConflictException)
  })
  it('唯一索引冲突在事务外读取已提交结果并返回', async () => {
    db.$transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '7' }))
    db.pointRecord.findUnique.mockResolvedValue(record)
    await expect(repo.adjust(2, dto, 7)).resolves.toBe(record)
  })
  it('死锁或事务超时没有已提交记录时返回409', async () => {
    db.$transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('deadlock', { code: 'P2034', clientVersion: '7' }))
    await expect(repo.adjust(2, dto, 7)).rejects.toBeInstanceOf(ConflictException)
  })
  it('流水写入失败传出异常，使事务整体回滚', async () => {
    tx.pointRecord.create.mockRejectedValue(new Error('write failed'))
    await expect(repo.adjust(2, dto, 7)).rejects.toThrow('write failed')
  })
  it('账户筛选同时包含欠积分及用户关键词', async () => {
    await repo.accounts({ ...new QueryPointAccountsDto(), keyword: '1001', hasDebt: false })
    expect(db.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { pointDebt: 0, OR: [{ id: 1001 }, { nickname: { contains: '1001' } }, { mobile: { contains: '1001' } }] },
      skip: 0, take: 10,
    }))
  })
  it('北京时间结束日使用次日零点开区间，流水顺序稳定', async () => {
    await repo.flows({ ...new QueryPointFlowsDto(), startDate: '2026-10-06', endDate: '2026-10-06', userId: 2, keyword: '张', orderNo: 'ORDER', type: 'ORDER_DEDUCT' })
    expect(db.pointRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 2, flowType: 'ORDER_DEDUCT', orderNo: { contains: 'ORDER' },
        createdAt: { gte: new Date('2026-10-05T16:00:00Z'), lt: new Date('2026-10-06T16:00:00Z') },
      }),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }))
  })
})

import { BadRequestException, NotFoundException } from '@nestjs/common'
import { calculatePointChange, writePointChange } from './point-ledger'

describe('积分变动口径', () => {
  const account = { id: 1, points: 120, pointDebt: 30, totalPointsEarned: 500, totalPointsUsed: 380, status: true }
  it('增加积分先偿还欠积分，累计获得包含抵偿部分', () => {
    expect(calculatePointChange(account, 'MANUAL_INCREASE', 100)).toEqual({
      balance: 190, debt: 0, totalPointsEarned: 600, totalPointsUsed: 380, earned: 100, offset: 30,
    })
  })
  it('增加全部用于抵偿时仍记录获得总额', () => {
    expect(calculatePointChange(account, 'ORDER_REWARD', 20)).toMatchObject({
      balance: 120, debt: 10, earned: 20, offset: 20, totalPointsEarned: 520,
    })
  })
  it('人工扣减只扣可用积分并增加累计使用', () => {
    expect(calculatePointChange(account, 'MANUAL_DECREASE', 100)).toMatchObject({
      balance: 20, debt: 30, totalPointsUsed: 480, earned: null, offset: null,
    })
  })
  it('余额不足拒绝扣减，不转为欠积分', () => {
    expect(() => calculatePointChange(account, 'MANUAL_DECREASE', 121)).toThrow(BadRequestException)
  })
  it.each(['CANCEL_RETURN', 'REFUND_RETURN'] as const)('%s 冲减使用、不增加累计获得，返还先抵偿欠积分', type => {
    expect(calculatePointChange(account, type, 100)).toMatchObject({
      balance: 190, debt: 0, totalPointsEarned: 500, totalPointsUsed: 280, earned: null, offset: null,
    })
  })
  it('退款追回余额不足时只增加欠积分，不影响累计获得和使用', () => {
    expect(calculatePointChange(account, 'REFUND_RECOVER', 150)).toMatchObject({
      balance: 0, debt: 60, totalPointsEarned: 500, totalPointsUsed: 380, earned: null,
    })
  })
  it('余额、欠积分或累计值溢出时拒绝', () => {
    expect(() => calculatePointChange({ ...account, points: 2147483647, pointDebt: 0 }, 'MANUAL_INCREASE', 1)).toThrow(BadRequestException)
    expect(() => calculatePointChange({ ...account, totalPointsEarned: 2147483647 }, 'MANUAL_INCREASE', 1)).toThrow(BadRequestException)
    expect(() => calculatePointChange({ ...account, totalPointsUsed: 2147483647 }, 'MANUAL_DECREASE', 1)).toThrow(BadRequestException)
    expect(() => calculatePointChange({ ...account, points: 0, pointDebt: 2147483647 }, 'REFUND_RECOVER', 1)).toThrow(BadRequestException)
  })
  it.each([0, -1, 1.5, 2147483648])('拒绝非法数量 %s', amount => {
    expect(() => calculatePointChange(account, 'MANUAL_INCREASE', amount)).toThrow(BadRequestException)
  })
  it('只发生欠积分变化也写入完整流水', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([account]),
      user: { update: jest.fn() },
      pointRecord: { create: jest.fn() },
    }
    await writePointChange(tx as never, { userId: 1, flowType: 'MANUAL_INCREASE', amount: 20, reason: '补偿', operatorId: 7, operatorName: '管理员' })
    expect(tx.pointRecord.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      change: 0, balanceBefore: 120, balance: 120, debtBefore: 30, debtAfter: 10, earned: 20, offset: 20, operatorId: 7,
    }) })
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.user.update.mock.invocationCallOrder[0])
  })
  it('用户不存在时拒绝写入', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([]), user: { update: jest.fn() } }
    await expect(writePointChange(tx as never, { userId: 1, flowType: 'MANUAL_INCREASE', amount: 1, reason: '补偿' })).rejects.toBeInstanceOf(NotFoundException)
    expect(tx.user.update).not.toHaveBeenCalled()
  })
})

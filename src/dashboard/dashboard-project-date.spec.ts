import { Prisma } from '../../generated/prisma/client'
import { AdminProjectService } from '../renovation-project/admin-project.service'

describe('后台项目计划完成日期写入', () => {
  const now = new Date('2026-10-06T04:00:00Z')
  let service: AdminProjectService, tx: any, row: any
  beforeEach(() => {
    row = {
      id: 1, name: '项目', customerName: '客户', mobile: '13800138000',
      plannedCompletionDate: new Date('2026-10-10T00:00:00Z'),
      quoteItems: [], progresses: [], followUps: [], quotedAmount: new Prisma.Decimal(0),
      contractAmount: null, createdAt: now, updatedAt: now,
    }
    tx = { renovationProject: {
      create: jest.fn(async ({ data }) => ({ ...row, ...data, quotedAmount: new Prisma.Decimal(data.quotedAmount) })),
      update: jest.fn(async ({ data }) => ({ ...row, ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) })),
    } }
    service = new AdminProjectService({ $transaction: fn => fn(tx) } as never)
    jest.spyOn(service as any, 'relations').mockResolvedValue(undefined)
    jest.spyOn(service as any, 'project').mockResolvedValue(row)
    jest.spyOn(service as any, 'lock').mockResolvedValue(now)
  })
  it('新建日期转换成日历DATE，响应返回YYYY-MM-DD', async () => {
    const result = await service.create({ name: '项目', customerName: '客户', mobile: '13800138000', plannedCompletionDate: '2026-10-08' })
    expect(tx.renovationProject.create.mock.calls[0][0].data.plannedCompletionDate).toEqual(new Date('2026-10-08T00:00:00Z'))
    expect(result.plannedCompletionDate).toBe('2026-10-08')
  })
  it('新建未传日期保存null', async () => {
    const result = await service.create({ name: '项目', customerName: '客户', mobile: '13800138000' })
    expect(result.plannedCompletionDate).toBeNull()
  })
  it('编辑未传日期保持原值', async () => {
    const result = await service.edit(1, { name: '修改项目' })
    expect(tx.renovationProject.update.mock.calls[0][0].data.plannedCompletionDate).toBeUndefined()
    expect(result.plannedCompletionDate).toBe('2026-10-10')
  })
  it('编辑null清除日期，其他字段仍不允许null', async () => {
    expect((await service.edit(1, { plannedCompletionDate: null })).plannedCompletionDate).toBeNull()
    await expect(service.edit(1, { name: null } as never)).rejects.toMatchObject({ status: 400 })
  })
  it('编辑有效日期同时更新返回值', async () => {
    expect((await service.edit(1, { plannedCompletionDate: '2026-10-12' })).plannedCompletionDate).toBe('2026-10-12')
  })
})

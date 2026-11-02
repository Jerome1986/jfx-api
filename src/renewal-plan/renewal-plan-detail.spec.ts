import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { CreateRenewalPlanDto } from './dto/create-renewal-plan.dto'
import { UpdateRenewalPlanDto } from './dto/update-renewal-plan.dto'
import { RenewalPlanRepository } from './renewal-plan.repository'
import { PrismaService } from '../prisma/prisma.service'

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }))

const pipe = new ValidationPipe({ transform: true, whitelist: true })
const base = { name: '方案', startingPrice: 10, items: [{ category: '主材', name: '材料', unit: '件', unitPrice: 10 }] }

describe('焕新方案方案详情数组', () => {
  it.each([CreateRenewalPlanDto, UpdateRenewalPlanDto])('保留数组顺序且允许空数组：%p', async (metatype) => {
    for (const detail of [['/second.jpg', '/first.jpg'], []]) {
      await expect(pipe.transform({ ...base, detail }, { type: 'body', metatype })).resolves.toHaveProperty('detail', detail)
    }
  })
  it.each([null, '/detail.jpg', [''], ['   '], [1], ['/valid.jpg', null], {}].map(value => [value]))('拒绝非法方案详情 %p', async (detail) => {
    for (const metatype of [CreateRenewalPlanDto, UpdateRenewalPlanDto]) {
      await expect(pipe.transform({ ...base, detail }, { type: 'body', metatype })).rejects.toThrow()
    }
  })
  it('新增和局部更新均可省略方案详情', async () => {
    await expect(pipe.transform(base, { type: 'body', metatype: CreateRenewalPlanDto })).resolves.toBeDefined()
    await expect(pipe.transform({ name: '新名称' }, { type: 'body', metatype: UpdateRenewalPlanDto })).resolves.toBeDefined()
  })
  it('新增默认空数组，局部更新不清空，显式空数组可清空', () => {
    const prisma = { renewalPlan: { create: jest.fn(), update: jest.fn() } }
    const repository = new RenewalPlanRepository(prisma as unknown as PrismaService)
    repository.create(base)
    expect(prisma.renewalPlan.create.mock.calls[0][0].data.detail).toEqual([])
    repository.update(1, { name: '改名' })
    expect(prisma.renewalPlan.update.mock.calls[0][0].data).not.toHaveProperty('detail')
    repository.update(1, { detail: [] })
    expect(prisma.renewalPlan.update.mock.calls[1][0].data.detail).toEqual([])
  })
})

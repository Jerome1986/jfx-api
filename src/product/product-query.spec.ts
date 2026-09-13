import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { QueryProductDto } from './dto/query-product.dto'
import { productQueryWhere, ProductRepository } from './product.repository'
import { ProductService } from './product.service'
import { PrismaService } from '../prisma/prisma.service'

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
})
const parse = (query: unknown): Promise<QueryProductDto> =>
  pipe.transform(query, {
    type: 'query',
    metatype: QueryProductDto,
  })

const integration =
  process.env.RUN_PRODUCT_DB_TESTS === '1' ? describe : describe.skip
integration('本地数据库商品筛选（事务回滚）', () => {
  it('验证大小写、描述、false、库存、分页和字面通配符', async () => {
    const db = new PrismaService()
    const rollback = new Error('ROLLBACK_TEST_FIXTURES')
    try {
      await db.$transaction(async (tx) => {
        const category = await tx.productCategory.create({
          data: { name: '商品筛选集成测试' },
        })
        const base = {
          categoryId: category.id,
          price: '10.00',
          mainImage: '',
          stock: 3,
        }
        await tx.product.createMany({
          data: [
            {
              ...base,
              name: 'Alpha',
              brand: 'MiXeD',
              isPublished: true,
              sort: 1,
            },
            {
              ...base,
              name: 'Beta',
              description: 'DESC_ONLY',
              isPublished: true,
              sort: 2,
            },
            { ...base, name: '50%_', isPublished: false, sort: 3 },
            { ...base, name: 'NoStock', isPublished: true, stock: 0, sort: 4 },
          ],
        })
        const find = (query: QueryProductDto) =>
          tx.product.findMany({
            where: productQueryWhere({ ...query, categoryId: category.id }),
            orderBy: [{ sort: 'asc' }, { id: 'asc' }],
          })
        expect((await find({ keyword: 'mixed' })).map((p) => p.name)).toEqual([
          'Alpha',
        ])
        expect(
          (await find({ keyword: 'desc_only' })).map((p) => p.name),
        ).toEqual(['Beta'])
        expect((await find({ isPublished: false })).map((p) => p.name)).toEqual(
          ['50%_'],
        )
        expect((await find({ keyword: '%_' })).map((p) => p.name)).toEqual([
          '50%_',
        ])
        const where = productQueryWhere({
          categoryId: category.id,
          isPublished: true,
          inStock: true,
        })
        const first = await tx.product.findMany({
          where,
          orderBy: [{ sort: 'asc' }, { id: 'asc' }],
          skip: 0,
          take: 1,
        })
        const second = await tx.product.findMany({
          where,
          orderBy: [{ sort: 'asc' }, { id: 'asc' }],
          skip: 1,
          take: 1,
        })
        expect(first[0].name).toBe('Alpha')
        expect(second[0].name).toBe('Beta')
        expect(await tx.product.count({ where })).toBe(2)
        throw rollback
      })
    } catch (error) {
      if (error !== rollback) throw error
    } finally {
      await db.$disconnect()
    }
  })
})

describe('商品查询参数', () => {
  it('显式解析 false 和分类ID，去除关键字空格', async () => {
    expect(
      await parse({
        keyword: ' 空调 ',
        categoryId: '12',
        isPublished: 'false',
      }),
    ).toMatchObject({
      keyword: '空调',
      categoryId: 12,
      isPublished: false,
    })
  })
  it('支持未传参数及空关键字', async () => {
    await expect(parse({})).resolves.toBeDefined()
    expect((await parse({ keyword: '  ' })).keyword).toBe('')
  })
  it.each(['0', '-1', '1.5', 'abc', '', '1e2'])(
    '拒绝非法分类ID %s',
    async (categoryId) => {
      await expect(parse({ categoryId })).rejects.toThrow()
    },
  )
  it.each(['0', '1', 'FALSE', 'yes', '', ['false']])(
    '拒绝非法状态 %s',
    async (isPublished) => {
      await expect(parse({ isPublished })).rejects.toThrow()
    },
  )
  it.each([
    { pageNum: '0' },
    { pageSize: '101' },
    { pageNum: '1.2' },
    { pageSize: '' },
  ])('拒绝非法分页 %p', async (query) => {
    await expect(parse(query)).rejects.toThrow()
  })
  it('组合分类、未上架、库存与四字段搜索条件', () => {
    expect(
      productQueryWhere({
        categoryId: 12,
        isPublished: false,
        inStock: true,
        keyword: ' AC ',
      }),
    ).toEqual({
      categoryId: 12,
      isPublished: false,
      stock: { gt: 0 },
      OR: ['name', 'brand', 'model', 'description'].map((field) => ({
        [field]: { contains: 'AC' },
      })),
    })
    expect(productQueryWhere({ keyword: ' ' })).toEqual({})
    expect(productQueryWhere({ keyword: '50%_' }).OR).toContainEqual({
      name: { contains: '50\\%\\_' },
    })
  })
  it('未传分页保持数组，分页查询返回完整元数据', async () => {
    const repo = {
      findAll: jest.fn().mockResolvedValue([{ id: 1 }]),
      findPage: jest.fn().mockResolvedValue([[{ id: 2 }], 21]),
    }
    const service = new ProductService(repo as unknown as ProductRepository)
    await expect(service.findAll({ isPublished: false })).resolves.toEqual([
      { id: 1 },
    ])
    expect(repo.findPage).not.toHaveBeenCalled()
    await expect(
      service.findAll({ pageNum: 2, pageSize: 10 }),
    ).resolves.toEqual({
      list: [{ id: 2 }],
      total: 21,
      pageNum: 2,
      pageSize: 10,
      totalPage: 3,
    })
    repo.findPage.mockResolvedValue([[], 0])
    await expect(service.findAll({ pageSize: 10 })).resolves.toEqual({
      list: [],
      total: 0,
      pageNum: 1,
      pageSize: 10,
      totalPage: 0,
    })
  })
})

import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { QueryProductDto } from './dto/query-product.dto'
import { productQueryWhere, ProductRepository } from './product.repository'
import { ProductService } from './product.service'
import { PrismaService } from '../prisma/prisma.service'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'

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

describe('SKU 编辑保存', () => {
  it.each([[], null])('拒绝空 SKU 列表 %p', async (skus) => {
    await expect(pipe.transform({ skus }, { type: 'body', metatype: UpdateProductDto })).rejects.toThrow()
    const repo = new ProductRepository({} as PrismaService)
    await expect(repo.update(1, { skus: skus as never })).rejects.toThrow('至少提供一个SKU')
  })

  it('完整列表保留已有和新增 SKU，并软删除缺失项', async () => {
    const tx = {
      product: { update: jest.fn(), findUniqueOrThrow: jest.fn() },
      productSku: {
        findFirst: jest.fn().mockResolvedValue({ id: 11, stock: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({ id: 13, stock: 0 }),
      },
      stockLog: { create: jest.fn() },
    }
    const repo = new ProductRepository({ $transaction: (fn: any) => fn(tx) } as unknown as PrismaService)
    await repo.update(1, { skus: [{ id: 11, name: '保留', price: 10, stock: 1 }, { name: '新增', price: 20, stock: 0 }] })
    expect(tx.productSku.updateMany).toHaveBeenLastCalledWith({
      where: { productId: 1, deletedAt: null, id: { notIn: [11, 13] } },
      data: { deletedAt: expect.any(Date), isEnabled: false },
    })
    tx.productSku.updateMany.mockClear()
    await repo.update(1, { name: '仅改名称' })
    expect(tx.productSku.updateMany).not.toHaveBeenCalled()
  })
})

describe('商品单位校验', () => {
  const createBody = {
    categoryId: 1,
    name: '龙头',
    mainImage: ['/product.jpg'],
    skus: [{ name: '默认规格', price: 10, stock: 1 }],
  }

  it.each([CreateProductDto, UpdateProductDto])('%p 接受单位和省略单位', async (metatype) => {
    const body = metatype === CreateProductDto ? createBody : {}
    await expect(pipe.transform({ ...body, unit: '套' }, { type: 'body', metatype }))
      .resolves.toHaveProperty('unit', '套')
    await expect(pipe.transform(body, { type: 'body', metatype })).resolves.toBeDefined()
  })

  it.each([null, '', '   ', 123, '件'.repeat(33)])('拒绝无效单位 %p', async (unit) => {
    for (const metatype of [CreateProductDto, UpdateProductDto]) {
      const body = metatype === CreateProductDto ? createBody : {}
      await expect(pipe.transform({ ...body, unit }, { type: 'body', metatype }))
        .rejects.toThrow()
    }
  })
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
          mainImage: ['/cover.jpg'],
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
            { ...base, name: 'NoStock', isPublished: true, sort: 4 },
          ],
        })
        const products = await tx.product.findMany({ where: { categoryId: category.id } })
        await tx.productSku.createMany({ data: products.map(product => ({
          productId: product.id, name: '默认',
          price: 10, stock: product.name === 'NoStock' ? 0 : 3,
        })) })
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
      skus: { some: { deletedAt: null, isEnabled: true, stock: { gt: 0 } } },
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

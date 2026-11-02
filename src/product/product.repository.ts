// 文件说明：产品数据仓储，封装数据库访问操作。
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'
import { QueryProductDto } from './dto/query-product.dto'
import { Prisma } from '../../generated/prisma/client'
import { ProductSkuDto } from './dto/product-sku.dto'

const productInclude = { category: true, skus: { where: { deletedAt: null }, orderBy: [{ sort: 'asc' }, { id: 'asc' }] } } satisfies Prisma.ProductInclude

// 构建商品列表查询条件
export function productQueryWhere(
  query: QueryProductDto,
): Prisma.ProductWhereInput {
  const keyword = query.keyword?.trim()
  // 转义 LIKE 通配符，让输入的 % 和 _ 按普通字符包含匹配。
  const contains = keyword?.replace(/[\\%_]/g, '\\$&')
  return {
    ...(query.categoryId !== undefined ? { categoryId: query.categoryId } : {}),
    ...(query.isPublished !== undefined
      ? { isPublished: query.isPublished }
      : {}),
    ...(query.inStock !== undefined
      ? { skus: { [query.inStock ? 'some' : 'none']: { deletedAt: null, isEnabled: true, stock: { gt: 0 } } } }
      : {}),
    ...(contains
      ? {
        OR: [
          { name: { contains } },
          { brand: { contains } },
          { model: { contains } },
          { description: { contains } },
        ],
      }
      : {}),
  }
}

@Injectable()
export class ProductRepository {
  // 注入 PrismaService，封装当前模块的数据库访问。
  constructor(private prisma: PrismaService) { }

  // 新增商品
  async create(createProductDto: CreateProductDto) {
    const { skus, ...data } = createProductDto
    this.validateSkus(skus)
    if (skus.some(sku => sku.id !== undefined)) throw new BadRequestException('新增商品不能指定SKU ID')
    return this.prisma.$transaction(async tx => {
      const product = await tx.product.create({ data })
      for (const sku of skus) await this.saveSku(tx, product.id, sku)
      return tx.product.findUniqueOrThrow({ where: { id: product.id }, include: productInclude })
    })
  }

  // 获取商品列表
  findAll(query: QueryProductDto = {}) {
    return this.prisma.product.findMany({
      where: productQueryWhere(query),
      include: productInclude,
      orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
    })
  }

  // 按商品名称搜索商品
  async findByName(productName: string, pageNum: number, pageSize: number) {
    return await Promise.all([
      this.prisma.product.findMany({
        where: { name: { contains: productName } },
        include: productInclude,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.product.count({ where: { name: { contains: productName } } })
    ])
  }

  // 分页查询商品列表
  findPage(query: QueryProductDto & { pageNum: number; pageSize: number }) {
    const where = productQueryWhere(query)
    return this.prisma.$transaction(
      [
        this.prisma.product.findMany({
          where,
          include: productInclude,
          orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
          skip: (query.pageNum - 1) * query.pageSize,
          take: query.pageSize,
        }),
        this.prisma.product.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    )
  }

  // 获取商品详情
  findOne(id: number) {
    return this.prisma.product.findUnique({
      where: { id },
      include: productInclude,
    })
  }

  // 更新商品
  async update(id: number, updateProductDto: UpdateProductDto) {
    const { skus, ...data } = updateProductDto
    if (skus !== undefined) this.validateSkus(skus)
    return this.prisma.$transaction(async tx => {
      await tx.product.update({ where: { id }, data })
      const retainedIds: number[] = []
      for (const sku of skus ?? []) retainedIds.push(await this.saveSku(tx, id, sku))
      if (skus !== undefined) {
        // 包含本次新增项，只删除提交列表中缺失的规格。
        await tx.productSku.updateMany({
          where: { productId: id, deletedAt: null, id: { notIn: retainedIds } },
          data: { deletedAt: new Date(), isEnabled: false },
        })
      }
      return tx.product.findUniqueOrThrow({ where: { id }, include: productInclude })
    })
  }

  // 删除商品
  async remove(id: number) {
    try {
      return await this.prisma.$transaction(async tx => {
        const used = await tx.stockLog.count({ where: { productId: id, type: { in: ['SALE', 'CANCEL_RELEASE'] } } })
        if (used) throw new BadRequestException('商品已有交易记录，请下架商品')
        await tx.stockLog.deleteMany({ where: { productId: id } })
        await tx.productSku.deleteMany({ where: { productId: id } })
        return tx.product.delete({ where: { id } })
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException('商品已被引用，请下架商品或解除引用')
      }
      throw error
    }
  }

  private validateSkus(skus: ProductSkuDto[]) {
    if (!Array.isArray(skus) || !skus.length) throw new BadRequestException('至少提供一个SKU')
    if (new Set(skus.map(sku => sku.name)).size !== skus.length) throw new BadRequestException('SKU名称不能重复')
    const ids = skus.flatMap(sku => sku.id === undefined ? [] : [sku.id])
    if (new Set(ids).size !== ids.length) throw new BadRequestException('SKU ID不能重复')
  }

  private async saveSku(tx: Prisma.TransactionClient, productId: number, input: ProductSkuDto) {
    const { id, ...data } = input
    const previous = id === undefined ? null : await tx.productSku.findFirst({ where: { id, productId, deletedAt: null } })
    if (id !== undefined && !previous) throw new BadRequestException('SKU不存在或不属于该商品')
    if (previous) {
      const changed = await tx.productSku.updateMany({ where: { id, productId, stock: previous.stock }, data })
      if (changed.count !== 1) throw new ConflictException('库存已变化，请刷新后重试')
    }
    const sku = previous ? { id: previous.id, stock: data.stock } : await tx.productSku.create({ data: { ...data, productId } })
    const change = sku.stock - (previous?.stock ?? 0)
    if (change !== 0) await tx.stockLog.create({
      data: { productId, skuId: sku.id, type: previous ? 'MANUAL' : 'INBOUND', change, stock: sku.stock },
    })
    return sku.id
  }
}

// 文件说明：产品数据仓储，封装数据库访问操作。
import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'
import { QueryProductDto } from './dto/query-product.dto'
import { Prisma } from '../../generated/prisma/client'

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
      ? { stock: query.inStock ? { gt: 0 } : { lte: 0 } }
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
  constructor(private prisma: PrismaService) { }

  // 新增商品
  create(createProductDto: CreateProductDto) {
    return this.prisma.product.create({
      data: createProductDto,
      include: { category: true },
    })
  }

  // 获取商品列表
  findAll(query: QueryProductDto = {}) {
    return this.prisma.product.findMany({
      where: productQueryWhere(query),
      include: { category: true },
      orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
    })
  }

  // 按商品名称搜索商品
  async findByName(productName: string, pageNum: number, pageSize: number) {
    return await Promise.all([
      this.prisma.product.findMany({
        where: { name: { contains: productName } },
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
          include: { category: true },
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
      include: { category: true },
    })
  }

  // 更新商品
  update(id: number, updateProductDto: UpdateProductDto) {
    return this.prisma.product.update({
      where: { id },
      data: updateProductDto,
      include: { category: true },
    })
  }

  // 删除商品
  remove(id: number) {
    return this.prisma.product.delete({ where: { id } })
  }
}

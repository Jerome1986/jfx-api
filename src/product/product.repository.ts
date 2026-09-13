// 文件说明：产品数据仓储，封装数据库访问操作。
import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'
import { QueryProductDto } from './dto/query-product.dto'
import { Prisma } from '../../generated/prisma/client'

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
  constructor(private prisma: PrismaService) {}

  create(createProductDto: CreateProductDto) {
    return this.prisma.product.create({
      data: createProductDto,
      include: { category: true },
    })
  }

  findAll(query: QueryProductDto = {}) {
    return this.prisma.product.findMany({
      where: productQueryWhere(query),
      include: { category: true },
      orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
    })
  }

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

  findOne(id: number) {
    return this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    })
  }

  update(id: number, updateProductDto: UpdateProductDto) {
    return this.prisma.product.update({
      where: { id },
      data: updateProductDto,
      include: { category: true },
    })
  }

  remove(id: number) {
    return this.prisma.product.delete({ where: { id } })
  }
}

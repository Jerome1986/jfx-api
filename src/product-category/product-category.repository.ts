// 文件说明：产品分类数据仓储，封装数据库访问操作。
import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'
import { CreateProductCategoryDto } from './dto/create-product-category.dto'
import { UpdateProductCategoryDto } from './dto/update-product-category.dto'

@Injectable()
export class ProductCategoryRepository {
  constructor(private prisma: PrismaService) { }

  // 新增分类
  create(createProductCategoryDto: CreateProductCategoryDto) {
    return this.prisma.productCategory.create({
      data: createProductCategoryDto,
    })
  }

  // 获取分类树
  findAll(sourceClient: string) {
    // 如果是小程序的请求，那么只返回启用的分类
    let where: any = { parentId: null }
    if (sourceClient === 'minimap') {
      where.isEnabled = true
    }
    return this.prisma.productCategory.findMany({
      where,
      include: {
        children: {
          orderBy: { sort: 'asc' },
        },
      },
      orderBy: { sort: 'asc' },
    })
  }

  // 获取分类详情
  findOne(id: number) {
    return this.prisma.productCategory.findUnique({
      where: { id },
      include: {
        children: {
          orderBy: { sort: 'asc' },
        },
      },
    })
  }

  // 更新分类
  update(id: number, updateProductCategoryDto: UpdateProductCategoryDto) {
    return this.prisma.productCategory.update({
      where: { id },
      data: updateProductCategoryDto,
    })
  }

  // 启用或禁用分类
  updateStatus(id: number, isEnabled: boolean) {
    return this.prisma.productCategory.update({
      where: { id },
      data: { isEnabled },
    })
  }

  // 删除分类
  remove(id: number) {
    return this.prisma.productCategory.delete({ where: { id } })
  }
}

import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'
import { CreateProductCategoryDto } from './dto/create-product-category.dto'
import { UpdateProductCategoryDto } from './dto/update-product-category.dto'

@Injectable()
export class ProductCategoryRepository {
  constructor(private prisma: PrismaService) {}

  create(createProductCategoryDto: CreateProductCategoryDto) {
    return this.prisma.productCategory.create({
      data: createProductCategoryDto,
    })
  }

  findAll() {
    return this.prisma.productCategory.findMany({
      where: { parentId: null },
      include: {
        children: {
          orderBy: { sort: 'asc' },
        },
      },
      orderBy: { sort: 'asc' },
    })
  }

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

  update(id: number, updateProductCategoryDto: UpdateProductCategoryDto) {
    return this.prisma.productCategory.update({
      where: { id },
      data: updateProductCategoryDto,
    })
  }

  updateStatus(id: number, isEnabled: boolean) {
    return this.prisma.productCategory.update({
      where: { id },
      data: { isEnabled },
    })
  }

  remove(id: number) {
    return this.prisma.productCategory.delete({ where: { id } })
  }
}

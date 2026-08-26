// 文件说明：案例分类数据仓储，封装数据库访问操作。
import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateCaseCategoryDto } from "./dto/create-case-category.dto";
import { UpdateCaseCategoryDto } from "./dto/update-case-category.dto";

@Injectable()
export class caseCategoryRepository {
  constructor(private prisma: PrismaService) { }

  // 新增分类
  create(createCaseCategoryDto: CreateCaseCategoryDto) {
    return this.prisma.caseCategory.create({ data: createCaseCategoryDto })
  }

  // 获取所有分类
  findAll() {
    return this.prisma.caseCategory.findMany()
  }

  // 根据分类ID获取案例
  findCasesByCategoryId(categoryId: number, pageNum: number, pageSize: number) {
    const where = { categoryId }

    return Promise.all([
      this.prisma.renovationCase.findMany({
        where,
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
        include: { favorites: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.renovationCase.count({ where }),
    ])
  }

  // 更新分类
  update(id: number, updateCaseCategoryDto: UpdateCaseCategoryDto) {
    return this.prisma.caseCategory.update({
      where: { id },
      data: updateCaseCategoryDto,
    })
  }

  // 启用或禁用分类
  updateStatus(id: number, isEnabled: boolean) {
    return this.prisma.caseCategory.update({
      where: { id },
      data: { isEnabled },
    })
  }

  // 删除分类
  remove(id: number) {
    return this.prisma.caseCategory.delete({
      where: { id },
    })
  }
}

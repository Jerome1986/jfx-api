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

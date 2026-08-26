// 文件说明：案例分类业务服务，负责业务规则与流程编排。
import { Injectable } from '@nestjs/common';
import { CreateCaseCategoryDto } from './dto/create-case-category.dto';
import { UpdateCaseCategoryDto } from './dto/update-case-category.dto';
import { caseCategoryRepository } from './case-category.repository';

@Injectable()
export class CaseCategoryService {
  constructor(private caseCategoryRepo: caseCategoryRepository) { }

  // 新增分类
  create(createCaseCategoryDto: CreateCaseCategoryDto) {
    return this.caseCategoryRepo.create(createCaseCategoryDto)
  }

  // 获取所有分类
  findAll() {
    return this.caseCategoryRepo.findAll()
  }

  // 根据分类ID获取案例
  async findCasesByCategoryId(categoryId: number, pageNum: number, pageSize: number) {
    const [list, total] = await this.caseCategoryRepo.findCasesByCategoryId(
      categoryId,
      pageNum,
      pageSize,
    )

    return {
      list,
      total,
      pageNum,
      pageSize,
      totalPage: Math.ceil(total / pageSize),
    }
  }

  update(id: number, updateCaseCategoryDto: UpdateCaseCategoryDto) {
    return this.caseCategoryRepo.update(id, updateCaseCategoryDto)
  }

  // 启用或禁用分类
  updateStatus(id: number, isEnabled: boolean) {
    return this.caseCategoryRepo.updateStatus(id, isEnabled)
  }

  remove(id: number) {
    return this.caseCategoryRepo.remove(id)
  }
}

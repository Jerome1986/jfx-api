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

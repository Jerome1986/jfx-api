// 文件说明：产品分类业务服务，负责业务规则与流程编排。
import { Injectable } from '@nestjs/common'
import { CreateProductCategoryDto } from './dto/create-product-category.dto'
import { UpdateProductCategoryDto } from './dto/update-product-category.dto'
import { ProductCategoryRepository } from './product-category.repository'

@Injectable()
export class ProductCategoryService {
  constructor(private productCategoryRepo: ProductCategoryRepository) { }

  // 新增分类
  create(createProductCategoryDto: CreateProductCategoryDto) {
    return this.productCategoryRepo.create(createProductCategoryDto)
  }

  // 获取分类树
  findAll(sourceClient: string) {
    return this.productCategoryRepo.findAll(sourceClient)
  }

  // 获取分类详情
  findOne(id: number) {
    return this.productCategoryRepo.findOne(id)
  }

  // 更新分类
  update(id: number, updateProductCategoryDto: UpdateProductCategoryDto) {
    return this.productCategoryRepo.update(id, updateProductCategoryDto)
  }

  // 启用或禁用分类
  updateStatus(id: number, isEnabled: boolean) {
    return this.productCategoryRepo.updateStatus(id, isEnabled)
  }

  // 删除分类
  remove(id: number) {
    return this.productCategoryRepo.remove(id)
  }
}

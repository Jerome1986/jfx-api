import { Injectable } from '@nestjs/common'
import { CreateProductCategoryDto } from './dto/create-product-category.dto'
import { UpdateProductCategoryDto } from './dto/update-product-category.dto'
import { ProductCategoryRepository } from './product-category.repository'

@Injectable()
export class ProductCategoryService {
  constructor(private productCategoryRepo: ProductCategoryRepository) {}

  create(createProductCategoryDto: CreateProductCategoryDto) {
    return this.productCategoryRepo.create(createProductCategoryDto)
  }

  findAll() {
    return this.productCategoryRepo.findAll()
  }

  findOne(id: number) {
    return this.productCategoryRepo.findOne(id)
  }

  update(id: number, updateProductCategoryDto: UpdateProductCategoryDto) {
    return this.productCategoryRepo.update(id, updateProductCategoryDto)
  }

  updateStatus(id: number, isEnabled: boolean) {
    return this.productCategoryRepo.updateStatus(id, isEnabled)
  }

  remove(id: number) {
    return this.productCategoryRepo.remove(id)
  }
}

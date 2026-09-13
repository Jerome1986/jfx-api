// 文件说明：产品业务服务，负责业务规则与流程编排。
import { Injectable } from '@nestjs/common'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'
import { ProductRepository } from './product.repository'
import { QueryProductDto } from './dto/query-product.dto'

@Injectable()
export class ProductService {
  constructor(private productRepo: ProductRepository) {}

  create(createProductDto: CreateProductDto) {
    return this.productRepo.create(createProductDto)
  }

  async findAll(query: QueryProductDto = {}) {
    if (query.pageNum === undefined && query.pageSize === undefined) {
      return this.productRepo.findAll(query)
    }
    const pageNum = query.pageNum ?? 1
    const pageSize = query.pageSize ?? 10
    const [list, total] = await this.productRepo.findPage({
      ...query,
      pageNum,
      pageSize,
    })
    return {
      list,
      total,
      pageNum,
      pageSize,
      totalPage: Math.ceil(total / pageSize),
    }
  }

  findOne(id: number) {
    return this.productRepo.findOne(id)
  }

  update(id: number, updateProductDto: UpdateProductDto) {
    return this.productRepo.update(id, updateProductDto)
  }

  remove(id: number) {
    return this.productRepo.remove(id)
  }
}

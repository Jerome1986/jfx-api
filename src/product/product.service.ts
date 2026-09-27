// 文件说明：产品业务服务，负责业务规则与流程编排。
import { Injectable } from '@nestjs/common'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'
import { ProductRepository } from './product.repository'
import { QueryProductDto } from './dto/query-product.dto'
import { SearchProductDto } from './dto/search-product.dto'

@Injectable()
export class ProductService {
  constructor(private productRepo: ProductRepository) { }

  // 新增商品
  create(createProductDto: CreateProductDto) {
    return this.productRepo.create(createProductDto)
  }

  // 获取商品列表
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

  // 按商品名称搜索商品
  async findByName(searchProductDto: SearchProductDto) {
    const pageNum = Number(searchProductDto.pageNum) || 1
    const pageSize = Number(searchProductDto.pageSize) || 10
    const [list, total] = await this.productRepo.findByName(searchProductDto.productName, pageNum, pageSize)
    return {
      list,
      total,
      pageNum,
      pageSize,
      totalPage: Math.ceil(total / pageSize)
    }
  }

  // 获取商品详情
  findOne(id: number) {
    return this.productRepo.findOne(id)
  }

  // 更新商品
  update(id: number, updateProductDto: UpdateProductDto) {
    return this.productRepo.update(id, updateProductDto)
  }

  // 删除商品
  remove(id: number) {
    return this.productRepo.remove(id)
  }
}

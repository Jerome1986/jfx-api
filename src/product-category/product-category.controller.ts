// 文件说明：产品分类控制器，处理相关 HTTP 请求。
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { CreateProductCategoryDto } from './dto/create-product-category.dto'
import { UpdateProductCategoryStatusDto } from './dto/update-product-category-status.dto'
import { UpdateProductCategoryDto } from './dto/update-product-category.dto'
import { ProductCategoryService } from './product-category.service'

@Controller('product-category')
export class ProductCategoryController {
  constructor(private readonly productCategoryService: ProductCategoryService) {}

  // 新增分类
  @Post('add')
  create(@Body() createProductCategoryDto: CreateProductCategoryDto) {
    return this.productCategoryService.create(createProductCategoryDto)
  }

  // 获取分类树
  @Get()
  findAll() {
    return this.productCategoryService.findAll()
  }

  // 获取分类详情
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productCategoryService.findOne(+id)
  }

  // 更新分类
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateProductCategoryDto: UpdateProductCategoryDto,
  ) {
    return this.productCategoryService.update(+id, updateProductCategoryDto)
  }

  // 启用或禁用分类
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateProductCategoryStatusDto,
  ) {
    return this.productCategoryService.updateStatus(
      +id,
      updateStatusDto.isEnabled,
    )
  }

  // 删除分类
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productCategoryService.remove(+id)
  }
}

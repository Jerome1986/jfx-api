// 文件说明：产品控制器，处理相关 HTTP 请求。
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
  BadRequestException,
} from '@nestjs/common'
import { ProductService } from './product.service'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'
import { QueryProductDto } from './dto/query-product.dto'
import { SearchProductDto } from './dto/search-product.dto'

@Controller('product')
export class ProductController {
  // 注入 ProductService，将接口请求交给业务服务处理。
  constructor(private readonly productService: ProductService) { }

  // 新增商品
  @Post('add')
  create(@Body() createProductDto: CreateProductDto) {
    return this.productService.create(createProductDto)
  }

  // 获取商品列表
  @Get()
  findAll(@Query() query: QueryProductDto) {
    return this.productService.findAll(query)
  }

  // 按分类查询商品，支持现有筛选和分页参数。
  @Get('category/:categoryId')
  findByCategory(
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Query() query: QueryProductDto,
  ) {
    if (!Number.isSafeInteger(categoryId) || categoryId < 1) {
      throw new BadRequestException('商品分类ID必须是正整数')
    }
    return this.productService.findAll({ ...query, categoryId })
  }

  // 按商品名称搜索商品
  @Get('web/search')
  findByName(@Query() searchProductDto: SearchProductDto) {
    return this.productService.findByName(searchProductDto)
  }

  // 获取商品详情
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productService.findOne(id)
  }

  // 更新商品
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productService.update(id, updateProductDto)
  }

  // 删除商品
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productService.remove(id)
  }
}

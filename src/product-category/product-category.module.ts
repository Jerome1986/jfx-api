// 文件说明：产品分类模块，组织控制器及相关依赖。
import { Module } from '@nestjs/common';
import { ProductCategoryService } from './product-category.service';
import { ProductCategoryController } from './product-category.controller';
import { ProductCategoryRepository } from './product-category.repository';

@Module({
  controllers: [ProductCategoryController],
  providers: [ProductCategoryService, ProductCategoryRepository],
})
export class ProductCategoryModule {}

// 文件说明：案例分类模块，组织控制器及相关依赖。
import { Module } from '@nestjs/common';
import { CaseCategoryService } from './case-category.service';
import { CaseCategoryController } from './case-category.controller';
import { caseCategoryRepository } from './case-category.repository';

@Module({
  controllers: [CaseCategoryController],
  providers: [CaseCategoryService, caseCategoryRepository],
})
export class CaseCategoryModule { }

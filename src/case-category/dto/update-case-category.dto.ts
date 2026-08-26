// 文件说明：案例分类更新请求的数据传输对象。
import { PartialType } from '@nestjs/mapped-types';
import { CreateCaseCategoryDto } from './create-case-category.dto';

export class UpdateCaseCategoryDto extends PartialType(CreateCaseCategoryDto) {}

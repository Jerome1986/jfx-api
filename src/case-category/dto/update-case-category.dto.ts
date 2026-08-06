import { PartialType } from '@nestjs/mapped-types';
import { CreateCaseCategoryDto } from './create-case-category.dto';

export class UpdateCaseCategoryDto extends PartialType(CreateCaseCategoryDto) {}

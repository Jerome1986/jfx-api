import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CaseCategoryService } from './case-category.service';
import { CreateCaseCategoryDto } from './dto/create-case-category.dto';
import { UpdateCaseCategoryDto } from './dto/update-case-category.dto';

@Controller('case-category')
export class CaseCategoryController {
  constructor(private readonly caseCategoryService: CaseCategoryService) { }

  // 新增分类
  @Post()
  create(@Body() createCaseCategoryDto: CreateCaseCategoryDto) {
    return this.caseCategoryService.create(createCaseCategoryDto);
  }

  // 获取所有分类
  @Get()
  findAll() {
    return this.caseCategoryService.findAll();
  }

  // 更新分类
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCaseCategoryDto: UpdateCaseCategoryDto) {
    return this.caseCategoryService.update(+id, updateCaseCategoryDto);
  }

  // 删除分类
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.caseCategoryService.remove(+id);
  }
}

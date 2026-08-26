// 文件说明：案例分类控制器，处理相关 HTTP 请求。
import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { CaseCategoryService } from './case-category.service';
import { CreateCaseCategoryDto } from './dto/create-case-category.dto';
import { UpdateCaseCategoryDto } from './dto/update-case-category.dto';
import { UpdateCaseCategoryStatusDto } from './dto/update-case-category-status.dto';
import { QueryCase } from '../case/dto/query-case.dto';

@Controller('case-category')
export class CaseCategoryController {
  constructor(private readonly caseCategoryService: CaseCategoryService) { }

  // 新增分类
  @Post('add')
  create(@Body() createCaseCategoryDto: CreateCaseCategoryDto) {
    return this.caseCategoryService.create(createCaseCategoryDto);
  }

  // 获取所有分类
  @Get()
  findAll() {
    return this.caseCategoryService.findAll();
  }

  // 根据分类ID获取案例
  @Get(':id/cases')
  findCasesByCategoryId(@Param('id') id: string, @Query() query: QueryCase) {
    const pageNum = Number(query.pageNum) || 1;
    const pageSize = Number(query.pageSize) || 10;

    return this.caseCategoryService.findCasesByCategoryId(+id, pageNum, pageSize);
  }

  // 更新分类
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCaseCategoryDto: UpdateCaseCategoryDto) {
    console.log('update', id, updateCaseCategoryDto)
    return this.caseCategoryService.update(+id, updateCaseCategoryDto);
  }

  // 启用或禁用分类
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() updateCaseCategoryStatusDto: UpdateCaseCategoryStatusDto) {
    console.log('status', updateCaseCategoryStatusDto)

    return this.caseCategoryService.updateStatus(+id, updateCaseCategoryStatusDto.isEnabled);
  }

  // 删除分类
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.caseCategoryService.remove(+id);
  }
}

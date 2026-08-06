import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { CaseService } from './case.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { QueryCase } from './dto/query-case.dto';

@Controller('case')
export class CaseController {
  constructor(private readonly caseService: CaseService) { }

  // 新增案例
  @Post('add')
  createCase(@Body() createCaseDto: CreateCaseDto) {
    console.log('case参数', createCaseDto)
    return this.caseService.createCase(createCaseDto);
  }

  // 获取案例(分页)
  @Get()
  findCase(@Query() query: QueryCase) {
    const pageNum = Number(query.pageNum) || 1
    const pageSize = Number(query.pageSize) || 10

    return this.caseService.findAllCase(pageNum, pageSize)
  }
}

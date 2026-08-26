// 文件说明：案例控制器，处理相关 HTTP 请求。
import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { CaseService } from './case.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { QueryCase } from './dto/query-case.dto';
import { PublishStatus } from '../../generated/prisma/enums';
import { SearchCaseQueryDto } from './dto/search-case-query.dto';

@Controller('case')
export class CaseController {
  constructor(private readonly caseService: CaseService) { }

  // 新增案例
  @Post('add')
  createCase(@Body() createCaseDto: CreateCaseDto) {
    console.log('case参数', createCaseDto)
    return this.caseService.createCase(createCaseDto)
  }

  // 获取案例(分页)
  @Get()
  findCase(@Query() query: QueryCase) {
    const pageNum = Number(query.pageNum) || 1
    const pageSize = Number(query.pageSize) || 10
    const userId = query.userId === undefined ? undefined : +query.userId

    return this.caseService.findAllCase(pageNum, pageSize, userId)
  }

  // 搜索案例（分页）
  @Get('search')
  searchCase(@Query() query: SearchCaseQueryDto) {
    return this.caseService.searchCase(query)
  }

  // 更新案例
  @Patch('update/:id')
  update(
    @Param('id') id: string,
    @Body() updateCaseDto: UpdateCaseDto
  ) {
    console.log('更新', updateCaseDto)

    return this.caseService.updateCaseDto(+id, updateCaseDto)
  }

  // 更新案例状态
  @Patch('status/:id')
  changeStauts(
    @Param('id') id: string,
    @Body('status') status: PublishStatus
  ) {
    return this.caseService.changeStauts(+id, status)
  }

  // 设置首页推荐
  @Patch('recommended/:id')
  isRecommendedByHome(
    @Param('id') id: string,
    @Body('isRecommended') isRecommended: boolean
  ) {
    return this.caseService.isRecommendedByHome(+id, isRecommended)
  }


  // 案例详情
  @Get('detail/:id')
  findOne(@Param('id') id: string, @Query('userId') userId: string) {
    const currentUserId = userId === undefined ? undefined : +userId
    return this.caseService.findOne(+id, currentUserId)
  }

  // 删除案例
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.caseService.remove(+id)
  }
}

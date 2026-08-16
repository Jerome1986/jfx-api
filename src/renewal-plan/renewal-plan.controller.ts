import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common'
import { CreateRenewalPlanDto } from './dto/create-renewal-plan.dto'
import { RenewalPlanService } from './renewal-plan.service'
import { UpdateRenewalPlanDto } from './dto/update-renewal-plan.dto'

@Controller('renewal-plan')
export class RenewalPlanController {
  constructor(private readonly renewalPlanService: RenewalPlanService) {}

  // 新增焕新方案
  @Post('add')
  create(@Body() createRenewalPlanDto: CreateRenewalPlanDto) {
    return this.renewalPlanService.create(createRenewalPlanDto)
  }

  // 获取全部焕新方案
  @Get()
  findAll() {
    return this.renewalPlanService.findAll()
  }

  // 获取焕新方案详情
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.renewalPlanService.findOne(id)
  }

  // 更新焕新方案
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRenewalPlanDto: UpdateRenewalPlanDto,
  ) {
    return this.renewalPlanService.update(id, updateRenewalPlanDto)
  }

  // 删除焕新方案
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.renewalPlanService.remove(id)
  }
}

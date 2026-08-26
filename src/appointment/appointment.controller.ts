// 文件说明：预约控制器，处理用户预约相关 HTTP 请求。
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { AppointmentService } from './appointment.service'
import { CreateFollowUpDto } from './dto/create-follow-up.dto'
import { CreatePlanAppointmentDto } from './dto/create-plan-appointment.dto'
import { QueryPlanAppointmentDto } from './dto/query-plan-appointment.dto'
import { UserJwtGuard } from './guards/user-jwt.guard'
import type { AuthenticatedUserRequest } from './guards/user-jwt.guard'

@Controller('appointment')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  // 提交焕新方案预约
  @Post('plan')
  createPlanAppointment(@Body() dto: CreatePlanAppointmentDto) {
    return this.appointmentService.createPlanAppointment(dto)
  }

  // 获取预约列表，可按预约类型筛选
  @Get()
  GetPlanAll(@Query() query: QueryPlanAppointmentDto) {
    const pageNum = Number(query.pageNum) || 1
    const pageSize = Number(query.pageSize) || 10

    return this.appointmentService.GetPlanAll(pageNum, pageSize, query.type)
  }

  // 获取当前登录用户的预约列表
  @Get('mine')
  @UseGuards(UserJwtGuard)
  getMyAppointments(
    @Req() request: AuthenticatedUserRequest,
    @Query() query: QueryPlanAppointmentDto,
  ) {
    const pageNum = Number(query.pageNum) || 1
    const pageSize = Number(query.pageSize) || 10

    return this.appointmentService.getMyAppointments(
      request.user.userId,
      pageNum,
      pageSize,
      query.type,
    )
  }

  // 获取焕新方案预约详情
  @Get('detail/:id')
  findOne(@Param('id') id) {
    return this.appointmentService.findOne(+id)
  }

  // 后台新增预约跟进记录
  @Post(':id/follow-up')
  createFollowUp(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateFollowUpDto,
  ) {
    return this.appointmentService.createFollowUp(id, dto)
  }

  // 取消焕新方案预约
  @Patch(':id/cancel')
  cancelPlanAppointment(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentService.cancelPlanAppointment(id)
  }
}

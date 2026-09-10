// 文件说明：预约控制器，处理用户预约相关 HTTP 请求。
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { AppointmentService } from './appointment.service'
import { CreateFollowUpDto } from './dto/create-follow-up.dto'
import { CreatePlanAppointmentDto } from './dto/create-plan-appointment.dto'
import { QueryPlanAppointmentDto } from './dto/query-plan-appointment.dto'
import { QueryAssignedAppointmentDto } from './dto/query-assigned-appointment.dto'
import { UserJwtGuard } from './guards/user-jwt.guard'
import type { AuthenticatedUserRequest } from './guards/user-jwt.guard'
import { ConfirmVisitDto } from './dto/confirm-visit-appointment.dto'

@Controller('appointment')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) { }

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

  // 根据用户 ID 查询对应员工负责的预约列表
  @Get('assigned')
  getAssignedAppointments(
    @Query() query: QueryAssignedAppointmentDto,
  ) {
    return this.appointmentService.getAssignedAppointments(
      query.userId,
      query.pageNum,
      query.pageSize,
      query.type,
    )
  }

  // 获取预约详情
  @Get('detail/:id')
  findOne(
    @Param('id') id,
    @Headers('authorization') authorization: string
  ) {
    console.log('authorization', authorization)
    // 获取请求的TOKEN
    const [scheme, token] = authorization?.split(' ') ?? []
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('请先登录')
    }

    return this.appointmentService.findOne(+id, token)
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

  // 给预约方案分配负责人
  @Patch(':id/assignee')
  reassignResponsiblePerson(@Param('id') id: string, @Body('employeeId') employeeId: string) {
    return this.appointmentService.reassignResponsiblePerson(+id, +employeeId)
  }

  // 将预约状态转换成待上门
  @Post(':id/confirm-visit')
  appointmentConfirmVisit(
    @Param('id', ParseIntPipe) id: number,
    @Headers('authorization') authorization: string,
    @Body() dto: ConfirmVisitDto
  ) {
    const [scheme, token] = authorization?.split(' ') ?? []
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('用户未登录')

    return this.appointmentService.appointmentConfirmVisit(+id, dto, token)
  }

  // 完成预约
  @Post(':id/complete')
  @UseGuards(UserJwtGuard)
  completeAppointment(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedUserRequest,
  ) {
    return this.appointmentService.completeAppointment(id, request.user)
  }
}

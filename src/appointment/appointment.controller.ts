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
  UseGuards,
} from '@nestjs/common'
import { AppointmentService } from './appointment.service'
import { CreateFollowUpDto } from './dto/create-follow-up.dto'
import { CreatePlanAppointmentDto } from './dto/create-plan-appointment.dto'
import { CreateCaseAppointmentDto } from './dto/create-case-appointment.dto'
import { CompleteAppointmentDto } from './dto/complete-appointment.dto'
import { QueryPlanAppointmentDto } from './dto/query-plan-appointment.dto'
import { QueryAssignedAppointmentDto } from './dto/query-assigned-appointment.dto'
import { UserJwtGuard } from '../common/auth/guards/user-jwt.guard'
import { CurrentUser } from '../common/auth/decorators/current-user.decorator'
import type { UserJwtPayload } from '../common/auth/interfaces/user-jwt-payload.interface'
import { ConfirmVisitDto } from './dto/confirm-visit-appointment.dto'
import { UpdateAppointmentRequirementDto } from './dto/update-appointment-requirement.dto'

@Controller('appointment')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) { }

  // 提交焕新方案预约
  @Post('plan')
  createPlanAppointment(@Body() dto: CreatePlanAppointmentDto) {
    return this.appointmentService.createPlanAppointment(dto)
  }

  // 提交装修案例同款报价预约
  @Post('case')
  @UseGuards(UserJwtGuard)
  createCaseAppointment(@Body() dto: CreateCaseAppointmentDto, @CurrentUser() user: UserJwtPayload) {
    return this.appointmentService.createCaseAppointment(dto, user)
  }

  // 员工补录预约客户及房屋需求信息
  @Patch(':id/customer-requirement')
  @UseGuards(UserJwtGuard)
  updateRequirement(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAppointmentRequirementDto,
    @CurrentUser() user: UserJwtPayload,
  ) {
    return this.appointmentService.updateRequirement(id, dto, user)
  }

  // 获取预约列表，可按预约类型筛选
  @Get()
  @UseGuards(UserJwtGuard)
  GetPlanAll(@Query() query: QueryPlanAppointmentDto, @CurrentUser('user') user: UserJwtPayload) {
    return this.appointmentService.GetPlanAll(query, user)
  }

  // 获取当前登录用户的预约列表
  @Get('mine')
  @UseGuards(UserJwtGuard)
  getMyAppointments(
    @CurrentUser() user: UserJwtPayload,
    @Query() query: QueryPlanAppointmentDto,
  ) {
    const pageNum = Number(query.pageNum) || 1
    const pageSize = Number(query.pageSize) || 10

    return this.appointmentService.getMyAppointments(
      user.userId,
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
      query.status,
    )
  }

  // 获取预约详情
  @Get('detail/:id')
  @UseGuards(UserJwtGuard)
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserJwtPayload,
  ) {
    return this.appointmentService.findOne(id, user)
  }

  // 后台新增预约跟进记录
  @Post(':id/follow-up')
  createFollowUp(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateFollowUpDto,
  ) {
    return this.appointmentService.createFollowUp(id, dto)
  }

  // 共用取消接口：预算、案例和焕新方案预约。
  @Patch(':id/cancel')
  cancelAppointment(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentService.cancelAppointment(id)
  }

  // 给预约方案分配负责人
  @Patch(':id/assignee')
  reassignResponsiblePerson(@Param('id') id: string, @Body('employeeId') employeeId: string) {
    return this.appointmentService.reassignResponsiblePerson(+id, +employeeId)
  }

  // 将预约状态转换成待上门
  @Post(':id/confirm-visit')
  @UseGuards(UserJwtGuard)
  appointmentConfirmVisit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmVisitDto,
    @CurrentUser() user: UserJwtPayload,
  ) {
    return this.appointmentService.appointmentConfirmVisit(id, dto, user)
  }

  // 完成预约
  @Post(':id/complete')
  @UseGuards(UserJwtGuard)
  completeAppointment(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserJwtPayload,
    @Body() dto: CompleteAppointmentDto = {},
  ) {
    return this.appointmentService.completeAppointment(id, user, dto)
  }
}

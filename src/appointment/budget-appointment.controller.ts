import { Body, Controller, Post } from '@nestjs/common'
import { AppointmentService } from './appointment.service'
import { CreateBudgetAppointmentDto } from './dto/create-budget-appointment.dto'

@Controller('appointment/budget')
export class BudgetAppointmentController {
  // 注入 AppointmentService，将接口请求交给业务服务处理。
  constructor(private readonly appointmentService: AppointmentService) { }

  // 装修计算器预约提交
  @Post()
  createBudgetAppointment(@Body() dto: CreateBudgetAppointmentDto) {
    return this.appointmentService.createBudgetAppointment(dto)
  }
}

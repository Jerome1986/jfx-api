import { Body, Controller, Post } from '@nestjs/common'
import { AppointmentService } from './appointment.service'
import { CreateBudgetAppointmentDto } from './dto/create-budget-appointment.dot'

@Controller('appointment/budget')
export class BudgetAppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  // 装修计算器预约提交
  @Post()
  createBudgetAppointment(@Body() dto: CreateBudgetAppointmentDto) {
    return this.appointmentService.createBudgetAppointment(dto)
  }
}

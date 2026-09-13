// 文件说明：预约模块，组织预约接口及业务依赖。
import { Module } from '@nestjs/common'
import { AppointmentController } from './appointment.controller'
import { AppointmentRepository } from './appointment.repository'
import { AppointmentService } from './appointment.service'
import { BudgetAppointmentController } from './budget-appointment.controller'
import { AuthModule } from '../common/auth/auth.module'

@Module({
  imports: [AuthModule],
  controllers: [AppointmentController, BudgetAppointmentController],
  providers: [AppointmentService, AppointmentRepository],
  exports: [AppointmentRepository],
})
export class AppointmentModule { }

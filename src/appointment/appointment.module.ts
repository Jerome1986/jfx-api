// 文件说明：预约模块，组织预约接口及业务依赖。
import { Module } from '@nestjs/common'
import { AppointmentController } from './appointment.controller'
import { AppointmentRepository } from './appointment.repository'
import { AppointmentService } from './appointment.service'
import { BudgetAppointmentController } from './budget-appointment.controller'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { UserJwtGuard } from './guards/user-jwt.guard'

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('SECRET'),
      }),
    }),
  ],
  controllers: [AppointmentController, BudgetAppointmentController],
  providers: [AppointmentService, AppointmentRepository, UserJwtGuard],
})
export class AppointmentModule { }

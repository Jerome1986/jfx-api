import { Module } from '@nestjs/common'
import { AuthModule } from '../common/auth/auth.module'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'
import { DashboardRepository } from './dashboard.repository'

@Module({
  imports: [AuthModule], controllers: [DashboardController],
  providers: [DashboardService, DashboardRepository],
})
export class DashboardModule {}

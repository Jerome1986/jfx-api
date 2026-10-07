import { Controller, Get, UseGuards } from '@nestjs/common'
import { UserJwtGuard } from '../common/auth/guards/user-jwt.guard'
import { AdminGuard } from '../common/auth/guards/admin.guard'
import { DashboardService } from './dashboard.service'

@Controller('dashboard')
@UseGuards(UserJwtGuard, AdminGuard)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}
  @Get('overview')
  overview() { return this.service.overview() }
}

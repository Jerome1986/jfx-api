import { Module } from '@nestjs/common'
import { AuthModule } from '../common/auth/auth.module'
import { PointController } from './point.controller'
import { PointGuard } from './point.guard'
import { PointRepository } from './point.repository'
import { PointService } from './point.service'

@Module({
  imports: [AuthModule],
  controllers: [PointController],
  providers: [PointService, PointRepository, PointGuard],
})
export class PointModule {}

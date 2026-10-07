import { Module } from '@nestjs/common'
import { AuthModule } from '../common/auth/auth.module'
import { PointRuleController } from './point-rule.controller'
import { PointRuleGuard } from './point-rule.guard'
import { PointRuleRepository } from './point-rule.repository'
import { PointRuleService } from './point-rule.service'

@Module({
  imports: [AuthModule],
  controllers: [PointRuleController],
  providers: [PointRuleService, PointRuleRepository, PointRuleGuard],
})
export class PointRuleModule {}

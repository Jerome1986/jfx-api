import { Module } from '@nestjs/common';
import { RenewalPlanService } from './renewal-plan.service';
import { RenewalPlanController } from './renewal-plan.controller';
import { RenewalPlanRepository } from './renewal-plan.repository';

@Module({
  controllers: [RenewalPlanController],
  providers: [RenewalPlanService, RenewalPlanRepository],
})
export class RenewalPlanModule {}

// 文件说明：续费方案模块，组织控制器及相关依赖。
import { Module } from '@nestjs/common';
import { RenewalPlanService } from './renewal-plan.service';
import { RenewalPlanController } from './renewal-plan.controller';
import { RenewalPlanRepository } from './renewal-plan.repository';

@Module({
  controllers: [RenewalPlanController],
  providers: [RenewalPlanService, RenewalPlanRepository],
})
export class RenewalPlanModule {}

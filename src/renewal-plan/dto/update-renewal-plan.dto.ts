// 文件说明：续费方案更新请求的数据传输对象。
import { PartialType } from '@nestjs/mapped-types';
import { CreateRenewalPlanDto } from './create-renewal-plan.dto';

export class UpdateRenewalPlanDto extends PartialType(CreateRenewalPlanDto) {}

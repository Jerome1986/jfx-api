import { PartialType } from '@nestjs/mapped-types';
import { CreateRenewalPlanDto } from './create-renewal-plan.dto';

export class UpdateRenewalPlanDto extends PartialType(CreateRenewalPlanDto) {}

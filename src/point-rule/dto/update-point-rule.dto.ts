import { PartialType } from '@nestjs/mapped-types';
import { CreatePointRuleDto } from './create-point-rule.dto';

export class UpdatePointRuleDto extends PartialType(CreatePointRuleDto) {}

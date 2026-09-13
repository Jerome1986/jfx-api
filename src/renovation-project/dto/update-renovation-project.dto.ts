import { PartialType } from '@nestjs/mapped-types';
import { CreateRenovationProjectDto } from './create-renovation-project.dto';

export class UpdateRenovationProjectDto extends PartialType(CreateRenovationProjectDto) {}

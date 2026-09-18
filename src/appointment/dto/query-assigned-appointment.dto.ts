import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, Min } from 'class-validator'
import { AppointmentStatus } from '../../../generated/prisma/enums'
import { PickType } from '@nestjs/mapped-types'
import { QueryPlanAppointmentDto } from './query-plan-appointment.dto'

export class QueryAssignedAppointmentDto extends PickType(
  QueryPlanAppointmentDto,
  ['type'] as const,
) {
  @IsOptional()
  @IsIn(['ALL', ...Object.values(AppointmentStatus)])
  status?: AppointmentStatus | 'ALL'

  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId: number

  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageNum: number = 1

  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize: number = 10
}

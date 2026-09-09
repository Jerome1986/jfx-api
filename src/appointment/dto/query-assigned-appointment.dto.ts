import { Type } from 'class-transformer'
import { IsInt, Min } from 'class-validator'
import { PickType } from '@nestjs/mapped-types'
import { QueryPlanAppointmentDto } from './query-plan-appointment.dto'

export class QueryAssignedAppointmentDto extends PickType(
  QueryPlanAppointmentDto,
  ['type'] as const,
) {
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

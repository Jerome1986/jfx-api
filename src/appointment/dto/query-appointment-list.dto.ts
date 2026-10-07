import { IsIn, IsOptional } from 'class-validator'
import { QueryPlanAppointmentDto } from './query-plan-appointment.dto'

export class QueryAppointmentListDto extends QueryPlanAppointmentDto {
  @IsOptional()
  @IsIn(['uncontacted', 'unassigned'])
  alertType?: 'uncontacted' | 'unassigned'
}

import { IsIn, IsOptional, IsString } from 'class-validator'
import { AppointmentType } from '../../../generated/prisma/enums'

export type AppointmentTypeFilter = AppointmentType | 'ALL'

export class QueryPlanAppointmentDto {
  @IsString()
  pageNum: string
  @IsString()
  pageSize: string

  @IsOptional()
  @IsIn(['ALL', ...Object.values(AppointmentType)], {
    message: '预约类型只能是ALL、BUDGET、MEASURE、QUOTE、PLAN、CASE或OUTLET',
  })
  type?: AppointmentTypeFilter
}

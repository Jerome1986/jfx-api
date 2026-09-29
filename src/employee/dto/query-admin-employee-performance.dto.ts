import { Transform } from 'class-transformer'
import { IsBoolean, IsOptional, IsString } from 'class-validator'
import { QueryEmployeePerformanceDto } from './query-employee-performance.dto'

// 后台沿用业绩月份、分页校验，增加员工筛选条件。
export class QueryAdminEmployeePerformanceDto extends QueryEmployeePerformanceDto {
  @IsOptional()
  @IsString()
  keyword?: string

  @IsOptional()
  @IsString()
  department?: string

  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  status?: boolean
}

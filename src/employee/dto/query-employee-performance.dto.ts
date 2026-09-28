import { Type } from 'class-transformer'
import { IsInt, Matches, Max, Min, ValidateIf } from 'class-validator'

export class QueryEmployeePerformanceDto {
  // 不传为北京时间本月；all 表示累计。
  @ValidateIf((_object, value) => value !== undefined)
  @Matches(/^(all|[1-9][0-9]{3}-(0[1-9]|1[0-2]))$/)
  month?: string

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  pageNum: number = 1

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 10
}

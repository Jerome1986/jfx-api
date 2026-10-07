import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator'

export const POINT_FLOW_TYPES = [
  'ORDER_REWARD', 'ORDER_DEDUCT', 'CANCEL_RETURN', 'REFUND_RETURN', 'REFUND_RECOVER',
  'MANUAL_INCREASE', 'MANUAL_DECREASE', 'LEGACY_INCOME', 'LEGACY_EXPENSE', 'LEGACY_MANUAL', 'LEGACY_EXPIRED',
] as const

export class QueryPointAccountsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  page: number = 1

  @Type(() => Number)
  @IsIn([10, 20, 50])
  pageSize: number = 10

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(100)
  keyword?: string

  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  hasDebt?: boolean
}

export class QueryPointFlowsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  page: number = 1

  @Type(() => Number)
  @IsIn([10, 20, 50])
  pageSize: number = 10

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  userId?: number

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(100)
  keyword?: string

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(100)
  orderNo?: string

  @IsOptional()
  @IsIn(POINT_FLOW_TYPES)
  type?: string

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  startDate?: string

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  endDate?: string
}

export class PointAccountParamsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  userId: number
}

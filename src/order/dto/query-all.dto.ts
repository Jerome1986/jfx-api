import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator"
import { ProductOrderStatus } from "../../../generated/prisma/enums"

export class QueryAllDto {
  @IsOptional()
  @IsEnum([...Object.values(ProductOrderStatus), 'ALL'])
  status: ProductOrderStatus | 'ALL'

  @IsOptional()
  @IsString()
  keyWords?: string

  @IsOptional()
  @IsString()
  pageNum?: number

  @IsOptional()
  @IsString()
  pageSize?: number

  @IsOptional()
  @IsDateString({ strict: true }, { message: '开始时间必须是有效的日期字符串' })
  createdAtStart?: string

  @IsOptional()
  @IsDateString({ strict: true }, { message: '结束时间必须是有效的日期字符串' })
  createdAtEnd?: string
}
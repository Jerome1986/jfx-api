import { IsEnum, IsIn, IsOptional, IsString } from "class-validator";
import { ProductOrderStatus } from "../../../generated/prisma/enums";

export class QueryOrderDto {
  @IsIn([...Object.values(ProductOrderStatus), 'ALL'])
  status: ProductOrderStatus | 'ALL'

  @IsOptional()
  @IsString()
  pageNum?: string

  @IsOptional()
  @IsString()
  pageSize?: string
}
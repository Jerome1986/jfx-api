import { IsIn, IsOptional, IsString } from 'class-validator';
import { PointChangeType } from "../../../generated/prisma/enums"

export class QueryScoreDto {
  @IsIn(['ALL', ...Object.values(PointChangeType)])
  type: PointChangeType | 'ALL'

  @IsOptional()
  @IsString()
  pageNum: string

  @IsOptional()
  @IsString()
  pageSize: string
}
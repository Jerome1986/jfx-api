import { IsIn, IsOptional, IsString } from "class-validator"
import { FeedbackStatus } from "../../../generated/prisma/enums"

export class QueryFeedbackDto {
  @IsOptional()
  @IsIn(['overdue'])
  alertType?: 'overdue'

  @IsOptional()
  @IsString()
  keyWords?: string

  @IsOptional()
  @IsIn([...Object.values(FeedbackStatus), 'ALL'])
  status?: FeedbackStatus | 'ALL'

  @IsOptional()
  @IsString()
  pageNum?: string

  @IsOptional()
  @IsString()
  pageSize?: string
}
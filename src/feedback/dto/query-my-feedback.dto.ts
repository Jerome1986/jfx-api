import { Type } from 'class-transformer'
import { IsInt, Max, Min } from 'class-validator'

// 我的反馈记录分页参数，用户身份由登录凭证提供
export class QueryMyFeedbackDto {
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

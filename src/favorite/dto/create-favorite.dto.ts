import { Type } from 'class-transformer'
import { IsInt, Min } from 'class-validator'

export class CreateFavoriteDto {
  @Type(() => Number)
  @IsInt({ message: '用户ID必须是整数' })
  @Min(1, { message: '用户ID必须大于0' })
  userId: number

  @Type(() => Number)
  @IsInt({ message: '案例ID必须是整数' })
  @Min(1, { message: '案例ID必须大于0' })
  caseId: number
}

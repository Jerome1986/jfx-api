import { Type } from 'class-transformer'
import { IsInt, IsOptional, Min } from 'class-validator'

export class CreateFavoriteDto {
  // 兼容旧客户端；实际所属用户以登录身份为准。
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '用户ID必须是整数' })
  @Min(1, { message: '用户ID必须大于0' })
  userId?: number

  @Type(() => Number)
  @IsInt({ message: '案例ID必须是整数' })
  @Min(1, { message: '案例ID必须大于0' })
  caseId: number
}

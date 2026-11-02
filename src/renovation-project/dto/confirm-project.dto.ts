import { IsInt, IsOptional, Max, Min } from 'class-validator'

export class ConfirmProjectDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  userCouponId?: number

  @IsInt()
  @Min(1)
  @Max(2147483647)
  quoteVersion: number
}

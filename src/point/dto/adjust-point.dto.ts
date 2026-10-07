import { Transform } from 'class-transformer'
import { IsIn, IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator'

export class AdjustPointDto {
  @IsIn(['increase', 'decrease'])
  direction: 'increase' | 'decrease'

  @IsInt()
  @Min(1)
  @Max(1000000000)
  amount: number

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  reason: string

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,100}$/, { message: 'requestId须为1至100位字母、数字、下划线或短横线' })
  requestId: string
}

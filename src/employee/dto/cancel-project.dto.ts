import { Transform } from 'class-transformer'
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator'

export class CancelProjectDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty({ message: '请填写取消原因' })
  @MaxLength(500, { message: '取消原因不能超过500个字符' })
  reason: string

  @IsIn(['PENDING_CONFIRM', 'IN_SERVICE'])
  expectedStatus: 'PENDING_CONFIRM' | 'IN_SERVICE'
}

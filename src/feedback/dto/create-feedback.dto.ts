import { Transform } from 'class-transformer'
import { IsString, MaxLength, MinLength } from 'class-validator'

// 去除文本首尾空白
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value

export class CreateFeedbackDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  type: string

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string
}

import { Transform } from 'class-transformer'
import { IsString, MaxLength, MinLength } from 'class-validator'

// 管理员回复意见反馈参数
export class ReplyFeedbackDto {
  // 回复内容：去除首尾空白，限制为 1～5000 字符
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  reply: string
}

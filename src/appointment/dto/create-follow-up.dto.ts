import { Type } from 'class-transformer'
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator'

// 后台新增预约跟进记录请求参数
export class CreateFollowUpDto {
  @IsString({ message: '跟进信息必须是字符串' })
  @IsNotEmpty({ message: '跟进信息不能为空' })
  content: string

  @IsOptional()
  @IsDateString({}, { message: '下次跟进时间必须是有效的ISO 8601日期时间' })
  nextFollowAt?: string | null

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '跟进负责人ID必须是整数' })
  @Min(1, { message: '跟进负责人ID必须大于0' })
  employeeId?: number | null
}

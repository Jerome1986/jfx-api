import { Transform } from 'class-transformer'
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator'

export class CompleteAppointmentDto {
  // 是否必填由 Service 根据数据库中的预约类型判断。
  @IsOptional()
  @IsString({ message: '预估金额必须是字符串' })
  @Matches(/^(?:0\.(?:0[1-9]|[1-9]\d?)|[1-9]\d{0,7}(?:\.\d{1,2})?)$/, {
    message: '预估金额必须大于0且最多为8位整数、2位小数',
  })
  estimatedAmount?: string | null

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString({ message: '报价说明必须是字符串' })
  @MaxLength(191, { message: '报价说明不能超过191个字符' })
  estimateDescription?: string | null
}

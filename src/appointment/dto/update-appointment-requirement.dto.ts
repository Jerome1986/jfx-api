// 文件说明：员工补录预约客户及房屋需求信息的请求数据传输对象。
import { Transform, Type } from 'class-transformer'
import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator'

const trimText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value

export class UpdateAppointmentRequirementDto {
  @IsOptional()
  @Transform(trimText)
  @IsString({ message: '客户姓名必须是字符串' })
  @MaxLength(50, { message: '客户姓名不能超过50个字符' })
  customerName?: string

  @IsOptional()
  @Transform(trimText)
  @IsString({ message: '房屋类型必须是字符串' })
  @MaxLength(50, { message: '房屋类型不能超过50个字符' })
  houseType?: string

  @IsOptional()
  @Transform(trimText)
  @IsString({ message: '所在城市必须是字符串' })
  @MaxLength(100, { message: '所在城市不能超过100个字符' })
  city?: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: '房屋面积必须是最多两位小数的数字' })
  @Min(0.01, { message: '房屋面积必须大于0' })
  area?: number

  @IsOptional()
  @Transform(trimText)
  @IsString({ message: '房屋户型必须是字符串' })
  @MaxLength(100, { message: '房屋户型不能超过100个字符' })
  roomLayout?: string

  @IsOptional()
  @Transform(trimText)
  @IsString({ message: '预约需求必须是字符串' })
  @MaxLength(2000, { message: '预约需求不能超过2000个字符' })
  demand?: string

  @IsOptional()
  @Transform(trimText)
  @IsString({ message: '关注重点必须是字符串' })
  @MaxLength(191, { message: '关注重点不能超过191个字符' })
  focus?: string
}

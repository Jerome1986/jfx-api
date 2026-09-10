import { Type } from 'class-transformer'
import {
  IsEnum,
  IsInt,
  IsMobilePhone,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator'
import { AppointmentType } from '../../../generated/prisma/enums'

export class CreateBudgetAppointmentDto {
  @IsString({ message: '预约编号必须是字符串' })
  @IsNotEmpty({ message: '预约编号不能为空' })
  @MaxLength(64, { message: '预约编号不能超过64个字符' })
  appointmentNo: string

  @Type(() => Number)
  @IsInt({ message: '用户ID必须是整数' })
  @Min(1, { message: '用户ID必须大于0' })
  userId: number

  @IsEnum(AppointmentType, {
    message: '预约类型只能是BUDGET、MEASURE、QUOTE、PLAN、CASE或OUTLET',
  })
  type: AppointmentType

  @IsString({ message: '预约来源必须是字符串' })
  @IsNotEmpty({ message: '预约来源不能为空' })
  @MaxLength(100, { message: '预约来源不能超过100个字符' })
  source: string

  @IsMobilePhone('zh-CN', {}, { message: '手机号码格式不正确' })
  mobile: string

  @IsString({ message: '房屋类型必须是字符串' })
  @IsNotEmpty({ message: '房屋类型不能为空' })
  @MaxLength(100, { message: '房屋类型不能超过100个字符' })
  houseType: string

  @IsString({ message: '城市必须是字符串' })
  @IsNotEmpty({ message: '城市不能为空' })
  @MaxLength(100, { message: '城市不能超过100个字符' })
  city: string

  @IsString({ message: '房屋面积必须是字符串' })
  @IsNotEmpty({ message: '房屋面积不能为空' })
  @Matches(/^(?:0\.(?:0[1-9]|[1-9]\d?)|[1-9]\d{0,5}(?:\.\d{1,2})?)$/, {
    message: '房屋面积必须大于0且最多为6位整数、2位小数',
  })
  area: string

  @IsString({ message: '户型布局必须是字符串' })
  @IsNotEmpty({ message: '户型布局不能为空' })
  @MaxLength(100, { message: '户型布局不能超过100个字符' })
  roomLayout: string
}

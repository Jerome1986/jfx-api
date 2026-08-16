import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsMobilePhone,
  IsOptional,
  IsString,
} from 'class-validator'
import { Gender, UserRole } from '../../../generated/prisma/enums'

export class UpdateUserDto {
  @IsOptional()
  @IsEnum(UserRole, { message: '用户角色只能是CUSTOMER或EMPLOYEE' })
  role?: UserRole

  @IsOptional()
  @IsMobilePhone('zh-CN', {}, { message: '手机号码格式不正确' })
  mobile?: string

  @IsOptional()
  @IsEnum(Gender, { message: '性别只能是MALE或FEMALE' })
  gender?: Gender

  @IsOptional()
  @IsString({ message: '昵称必须是字符串' })
  nickname?: string

  @IsOptional()
  @IsString({ message: '真实姓名必须是字符串' })
  realName?: string

  @IsOptional()
  @IsString({ message: '头像地址必须是字符串' })
  avatar?: string

  @IsOptional()
  @IsString({ message: '来源渠道必须是字符串' })
  source?: string

  @IsOptional()
  @IsString({ message: '城市必须是字符串' })
  city?: string

  @IsOptional()
  @IsArray({ message: '标签必须是数组' })
  @IsString({ each: true, message: '每个标签必须是字符串' })
  tags?: string[]

  @IsOptional()
  @IsBoolean({ message: '用户状态必须是布尔值' })
  status?: boolean
}

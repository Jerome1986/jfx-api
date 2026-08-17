import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsMobilePhone,
  IsOptional,
  IsString,
} from 'class-validator'

export class CreateEmployeeDto {
  // 员工手机号；用于查询或注册关联用户
  @IsMobilePhone('zh-CN', {}, { message: '手机号码格式不正确' })
  mobile: string

  // 新用户昵称
  @IsOptional()
  @IsString({ message: '昵称必须是字符串' })
  nickname?: string

  // 新用户真实姓名
  @IsOptional()
  @IsString({ message: '真实姓名必须是字符串' })
  realName?: string

  // 员工岗位
  @IsOptional()
  @IsString({ message: '岗位必须是字符串' })
  position?: string

  // 所属部门
  @IsOptional()
  @IsString({ message: '部门必须是字符串' })
  department?: string

  // 可提供服务的区域列表
  @IsOptional()
  @IsArray({ message: '服务区域必须是数组' })
  @IsString({ each: true, message: '每个服务区域必须是字符串' })
  serviceRegions?: string[]

  // 入职时间，使用 ISO 日期字符串
  @IsOptional()
  @IsDateString({}, { message: '入职时间格式不正确' })
  hiredAt?: string

  // 是否在职或可用
  @IsOptional()
  @IsBoolean({ message: '员工状态必须是布尔值' })
  status?: boolean
}

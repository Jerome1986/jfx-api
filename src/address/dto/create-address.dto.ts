import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export class CreateAddressDto {
  // 地址所属用户
  @IsInt({ message: '用户ID必须是整数' })
  @Min(1, { message: '用户ID必须大于0' })
  userId: number

  // 联系人姓名
  @IsString({ message: '联系人姓名必须是字符串' })
  @IsNotEmpty({ message: '联系人姓名不能为空' })
  @MaxLength(50, { message: '联系人姓名不能超过50个字符' })
  contactName: string

  // 联系电话
  @IsString({ message: '联系电话必须是字符串' })
  @IsNotEmpty({ message: '联系电话不能为空' })
  @MaxLength(30, { message: '联系电话不能超过30个字符' })
  phone: string

  // 地图位置名称
  @IsOptional()
  @IsString({ message: '地图位置名称必须是字符串' })
  locationName?: string

  // 省份
  @IsOptional()
  @IsString({ message: '省份必须是字符串' })
  province?: string

  // 城市
  @IsOptional()
  @IsString({ message: '城市必须是字符串' })
  city?: string

  // 区县
  @IsOptional()
  @IsString({ message: '区县必须是字符串' })
  district?: string

  // 详细地址
  @IsString({ message: '详细地址必须是字符串' })
  @IsNotEmpty({ message: '详细地址不能为空' })
  address: string

  // 门牌号
  @IsOptional()
  @IsString({ message: '门牌号必须是字符串' })
  doorplate?: string

  // 纬度
  @IsOptional()
  @IsNumber({}, { message: '纬度必须是数字' })
  @Min(-90, { message: '纬度不能小于-90' })
  @Max(90, { message: '纬度不能大于90' })
  latitude?: number

  // 经度
  @IsOptional()
  @IsNumber({}, { message: '经度必须是数字' })
  @Min(-180, { message: '经度不能小于-180' })
  @Max(180, { message: '经度不能大于180' })
  longitude?: number

  // 是否为默认地址
  @IsOptional()
  @IsBoolean({ message: '是否为默认地址必须是布尔值' })
  isDefault?: boolean

  // 是否启用
  @IsOptional()
  @IsBoolean({ message: '是否启用必须是布尔值' })
  isEnabled?: boolean
}

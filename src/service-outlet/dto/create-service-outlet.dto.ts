// 文件说明：新增服务网点请求的数据传输对象。
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator'
import { Type } from 'class-transformer'

export class CreateServiceOutletDto {
  // 网点名称
  @IsString({ message: '网点名称必须是字符串' })
  @IsNotEmpty({ message: '网点名称不能为空' })
  name: string

  // 营业时间说明
  @IsString({ message: '营业时间必须是字符串' })
  @IsNotEmpty({ message: '营业时间不能为空' })
  businessHours: string

  // 联系电话
  @IsOptional()
  @IsString({ message: '联系电话必须是字符串' })
  phone?: string

  // 所在省份
  @IsOptional()
  @IsString({ message: '省份必须是字符串' })
  province?: string

  // 关联的服务城市 ID
  @Type(() => Number)
  @IsInt({ message: '城市ID必须是整数' })
  @Min(1, { message: '城市ID必须大于0' })
  cityId: number

  // 所在区县
  @IsOptional()
  @IsString({ message: '区县必须是字符串' })
  district?: string

  // 详细地址
  @IsString({ message: '详细地址必须是字符串' })
  @IsNotEmpty({ message: '详细地址不能为空' })
  address: string

  // 纬度，范围为 -90 至 90
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 }, { message: '纬度必须是最多七位小数的数字' })
  @Min(-90, { message: '纬度不能小于-90' })
  @Max(90, { message: '纬度不能大于90' })
  latitude?: number

  // 经度，范围为 -180 至 180
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 }, { message: '经度必须是最多七位小数的数字' })
  @Min(-180, { message: '经度不能小于-180' })
  @Max(180, { message: '经度不能大于180' })
  longitude?: number

  // 网点封面图片地址
  @IsOptional()
  @IsString({ message: '封面图片必须是字符串' })
  cover?: string

  // 后台排序值，数值越小越靠前
  @IsOptional()
  @IsInt({ message: '排序值必须是整数' })
  @Min(0, { message: '排序值不能小于0' })
  sort?: number

  // 网点是否启用
  @IsOptional()
  @IsBoolean({ message: '网点状态必须是布尔值' })
  status?: boolean
}

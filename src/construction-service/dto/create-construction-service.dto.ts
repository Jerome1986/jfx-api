import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator'

export class CreateConstructionServiceDto {
  // 服务名称
  @IsString({ message: '服务名称必须是字符串' })
  @IsNotEmpty({ message: '服务名称不能为空' })
  name: string

  // 服务内容或适用范围
  @IsOptional()
  @IsString({ message: '服务描述必须是字符串' })
  description?: string

  // 计价单位，例如：㎡、项、个
  @IsString({ message: '计价单位必须是字符串' })
  @IsNotEmpty({ message: '计价单位不能为空' })
  unit: string

  // 基础单价
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: '基础单价必须是最多保留两位小数的数字' },
  )
  @Min(0, { message: '基础单价不能小于0' })
  @Max(99999999.99, { message: '基础单价不能大于99999999.99' })
  unitPrice: number

  // 服务图片
  @IsOptional()
  @IsString({ message: '服务图片必须是字符串' })
  image?: string

  // 是否启用
  @IsOptional()
  @IsBoolean({ message: '启用状态必须是布尔值' })
  isEnabled?: boolean

  // 后台排序值
  @IsOptional()
  @IsInt({ message: '排序值必须是整数' })
  @Min(0, { message: '排序值不能小于0' })
  sort?: number
}

// 文件说明：员工创建装修项目及报价明细的请求 DTO。
import {
  ExclusiveQuoteSource,
  shouldValidateQuoteUnit,
} from '../../renovation-project/quote-item-validation'
import { Transform, Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsMobilePhone,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
  Validate,
  ValidateIf,
  Max,
} from 'class-validator'

// 项目明细参数
export class CreateProjectQuoteItemDto {
  @IsOptional()
  @Validate(ExclusiveQuoteSource)
  @Max(2147483647)
  @IsInt({ message: '商品ID必须是整数' })
  @Min(1, { message: '商品ID必须大于0' })
  productId?: number | null

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  serviceId?: number | null

  @IsString({ message: '业务分类必须是字符串' })
  @IsNotEmpty({ message: '业务分类不能为空' })
  @MaxLength(191, { message: '业务分类不能超过191个字符' })
  category: string

  @IsString({ message: '报价项目名称必须是字符串' })
  @IsNotEmpty({ message: '报价项目名称不能为空' })
  @MaxLength(191, { message: '报价项目名称不能超过191个字符' })
  name: string

  @IsOptional()
  @IsString({ message: '报价项目描述必须是字符串' })
  @MaxLength(191, { message: '报价项目描述不能超过191个字符' })
  description?: string | null

  @IsOptional()
  @IsString({ message: '报价项目图片必须是字符串' })
  @MaxLength(191, { message: '报价项目图片不能超过191个字符' })
  image?: string | null

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf(shouldValidateQuoteUnit)
  @IsString({ message: '计价单位必须是字符串' })
  @IsNotEmpty({ message: '计价单位不能为空' })
  @MaxLength(191, { message: '计价单位不能超过191个字符' })
  unit?: string | null

  @IsString({ message: '单价必须是字符串' })
  @Matches(/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/, {
    message: '单价必须为非负数且最多为8位整数、2位小数',
  })
  unitPrice: string

  @IsString({ message: '数量必须是字符串' })
  @Matches(/^(?:0\.(?:0[1-9]|[1-9]\d?)|[1-9]\d{0,7}(?:\.\d{1,2})?)$/, {
    message: '数量必须大于0且最多为8位整数、2位小数',
  })
  quantity: string
}

// 项目装修表参数
export class CreateProjectDto {
  @IsOptional()
  @IsInt({ message: '预约ID必须是整数' })
  @Min(1, { message: '预约ID必须大于0' })
  appointmentId?: number | null

  // 有预约时使用预约的 userId；无预约时可不关联用户账号。
  @IsOptional()
  @IsInt({ message: '客户用户ID必须是整数' })
  @Min(1, { message: '客户用户ID必须大于0' })
  userId?: number | null

  @IsString({ message: '客户姓名必须是字符串' })
  @IsNotEmpty({ message: '客户姓名不能为空' })
  @MaxLength(191, { message: '客户姓名不能超过191个字符' })
  customerName: string

  @IsMobilePhone('zh-CN', {}, { message: '手机号码格式不正确' })
  mobile: string

  @IsString({ message: '服务地址必须是字符串' })
  @IsNotEmpty({ message: '服务地址不能为空' })
  @MaxLength(191, { message: '服务地址不能超过191个字符' })
  serviceAddress: string

  @IsInt({ message: '方案ID必须是整数' })
  @Min(1, { message: '方案ID必须大于0' })
  planId: number

  @IsString({ message: '装修项目名称必须是字符串' })
  @IsNotEmpty({ message: '装修项目名称不能为空' })
  @MaxLength(191, { message: '装修项目名称不能超过191个字符' })
  name: string

  // employeeId 取当前登录员工，projectNo 由后端生成，quotedAmount 由明细汇总。
  // 明细的 projectId 和 sort 在保存时按项目及数组顺序设置。
  @IsArray({ message: '报价明细必须是数组' })
  @ArrayMinSize(1, { message: '请至少填写一项报价明细' })
  @IsObject({ each: true, message: '每项报价明细必须是对象' })
  @ValidateNested({ each: true })
  @Type(() => CreateProjectQuoteItemDto)
  quoteItems: CreateProjectQuoteItemDto[]
}

import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator'

// 案例改造亮点项
export class CaseHighlightDto {
  @IsString({ message: '亮点标题必须是字符串' })
  @IsNotEmpty({ message: '亮点标题不能为空' })
  title: string

  @IsString({ message: '亮点描述必须是字符串' })
  @IsNotEmpty({ message: '亮点描述不能为空' })
  description: string
}

// 案例费用组成项
export class CaseCostDto {
  @IsString({ message: '费用名称必须是字符串' })
  @IsNotEmpty({ message: '费用名称不能为空' })
  name: string

  @IsNumber({}, { message: '费用金额必须是数字' })
  @Min(0, { message: '费用金额不能小于0' })
  amount: number
}

// 新增案例请求参数
export class CreateCaseDto {
  @IsString({ message: '案例标题必须是字符串' })
  @IsNotEmpty({ message: '案例标题不能为空' })
  title: string

  @IsInt({ message: '案例分类ID必须是整数' })
  @Min(1, { message: '案例分类ID必须大于0' })
  categoryId: number

  @IsString({ message: '改造前封面必须是字符串' })
  @IsNotEmpty({ message: '改造前封面不能为空' })
  beforeCover: string

  @IsString({ message: '改造后封面必须是字符串' })
  @IsNotEmpty({ message: '改造后封面不能为空' })
  afterCover: string

  @IsString({ message: '城市必须是字符串' })
  @IsNotEmpty({ message: '城市不能为空' })
  city: string

  @IsString({ message: '户型必须是字符串' })
  @IsNotEmpty({ message: '户型不能为空' })
  roomType: string

  @IsNumber({}, { message: '面积必须是数字' })
  @Min(0, { message: '面积不能小于0' })
  area: number

  @IsString({ message: '装修风格必须是字符串' })
  @IsNotEmpty({ message: '装修风格不能为空' })
  style: string

  @IsArray({ message: '标签必须是数组' })
  @ArrayMinSize(1, { message: '至少需要一个标签' })
  @IsString({ each: true, message: '每个标签必须是字符串' })
  @IsNotEmpty({ each: true, message: '标签不能为空' })
  tags: string[]

  @IsNumber({}, { message: '总价必须是数字' })
  @Min(0, { message: '总价不能小于0' })
  totalPrice: number

  @IsInt({ message: '工期天数必须是整数' })
  @Min(1, { message: '工期天数不能小于1' })
  durationDays: number

  @IsInt({ message: '报价咨询次数必须是整数' })
  @Min(0, { message: '报价咨询次数不能小于0' })
  quoteCount: number

  @IsString({ message: '案例描述必须是字符串' })
  @IsNotEmpty({ message: '案例描述不能为空' })
  description: string

  @IsArray({ message: '改造亮点必须是数组' })
  @ArrayMinSize(1, { message: '至少需要填写一个改造亮点' })
  @ValidateNested({ each: true })
  @Type(() => CaseHighlightDto)
  highlights: CaseHighlightDto[]

  @IsArray({ message: '费用组成必须是数组' })
  @ArrayMinSize(1, { message: '至少需要填写一项费用' })
  @ValidateNested({ each: true })
  @Type(() => CaseCostDto)
  costs: CaseCostDto[]

  @IsBoolean({ message: '是否推荐必须是布尔值' })
  isRecommended: boolean

  @IsInt({ message: '推荐排序必须是整数' })
  @Min(0, { message: '推荐排序不能小于0' })
  recommendSort: number

  @IsString({ message: '发布状态必须是字符串' })
  @IsIn(['draft', 'published', 'offline'], {
    message: '发布状态只能是draft、published或offline',
  })
  status: 'draft' | 'published' | 'offline'
}

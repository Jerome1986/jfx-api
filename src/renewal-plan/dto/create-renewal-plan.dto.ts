// 文件说明：续费方案创建请求的数据传输对象。
import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator'

export class CreateRenewalPlanItemDto {
  @IsOptional()
  @IsInt({ message: '商品ID必须是整数' })
  @Min(1, { message: '商品ID必须大于0' })
  productId?: number

  @IsString({ message: '服务项目分类必须是字符串' })
  @IsNotEmpty({ message: '服务项目分类不能为空' })
  category: string

  @IsString({ message: '服务项目名称必须是字符串' })
  @IsNotEmpty({ message: '服务项目名称不能为空' })
  name: string

  @IsOptional()
  @IsString({ message: '服务项目描述必须是字符串' })
  description?: string

  @IsString({ message: '计价单位必须是字符串' })
  @IsNotEmpty({ message: '计价单位不能为空' })
  unit: string

  @IsNumber({}, { message: '单价必须是数字' })
  @Min(0, { message: '单价不能小于0' })
  unitPrice: number

  @IsOptional()
  @IsNumber({}, { message: '数量必须是数字' })
  @Min(0, { message: '数量不能小于0' })
  quantity?: number

  @IsOptional()
  @IsString({ message: '服务项目图片必须是字符串' })
  image?: string

  @IsOptional()
  @IsInt({ message: '服务项目排序值必须是整数' })
  @Min(0, { message: '服务项目排序值不能小于0' })
  sort?: number
}

export class CreateRenewalPlanDto {
  @IsString({ message: '方案名称必须是字符串' })
  @IsNotEmpty({ message: '方案名称不能为空' })
  name: string

  @IsOptional()
  @IsString({ message: '简介必须是字符串' })
  summary?: string

  @IsOptional()
  @IsArray({ message: '标签必须是数组' })
  @IsString({ each: true, message: '每个标签必须是字符串' })
  tags?: string[]

  @IsNumber({}, { message: '起步价必须是数字' })
  @Min(0, { message: '起步价不能小于0' })
  startingPrice: number

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray({ message: '封面图片必须是数组' })
  @IsString({ each: true, message: '每张封面图片必须是字符串' })
  @Matches(/\S/, { each: true, message: '封面图片地址不能为空' })
  cover?: string[]

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray({ message: '方案详情必须是图片数组' })
  @IsString({ each: true, message: '每张方案详情图必须是字符串' })
  @Matches(/\S/, { each: true, message: '方案详情图片地址不能为空' })
  detail?: string[]

  @IsOptional()
  @IsString({ message: '分享标题必须是字符串' })
  shareTitle?: string

  @IsOptional()
  @IsString({ message: '分享图片必须是字符串' })
  shareImage?: string

  @IsOptional()
  @IsInt({ message: '排序值必须是整数' })
  @Min(0, { message: '排序值不能小于0' })
  sort?: number

  @IsOptional()
  @IsBoolean({ message: '是否推荐必须是布尔值' })
  isRecommended?: boolean

  @IsOptional()
  @IsInt({ message: '推荐排序必须是整数' })
  @Min(0, { message: '推荐排序不能小于0' })
  recommendSort?: number

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'OFFLINE'], {
    message: '发布状态只能是DRAFT、PUBLISHED或OFFLINE',
  })
  status?: 'DRAFT' | 'PUBLISHED' | 'OFFLINE'

  @IsArray({ message: '服务项目列表必须是数组' })
  @ArrayMinSize(1, { message: '至少需要填写一个服务项目' })
  @ValidateNested({ each: true })
  @Type(() => CreateRenewalPlanItemDto)
  items: CreateRenewalPlanItemDto[]
}

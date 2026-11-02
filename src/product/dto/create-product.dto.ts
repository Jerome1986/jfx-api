// 文件说明：产品创建请求的数据传输对象。
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ArrayNotEmpty,
  ValidateNested,
  ValidateIf,
  MaxLength,
  Matches,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ProductSkuDto } from './product-sku.dto'

export class CreateProductDto {
  @IsInt({ message: '商品分类ID必须是整数' })
  @Min(1, { message: '商品分类ID必须大于0' })
  categoryId: number

  @IsString({ message: '商品名称必须是字符串' })
  @IsNotEmpty({ message: '商品名称不能为空' })
  name: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsString({ message: '商品单位必须是字符串' })
  @Matches(/\S/, { message: '商品单位不能为空' })
  @MaxLength(32, { message: '商品单位不能超过32个字符' })
  unit?: string

  @IsOptional()
  @IsString({ message: '商品描述必须是字符串' })
  description?: string

  @IsOptional()
  @IsString({ message: '品牌必须是字符串' })
  brand?: string

  @IsOptional()
  @IsString({ message: '产品型号必须是字符串' })
  model?: string

  @IsArray()
  @ArrayNotEmpty({ message: '至少提供一个SKU' })
  @ValidateNested({ each: true })
  @Type(() => ProductSkuDto)
  skus: ProductSkuDto[]

  @IsArray({ message: '商品主图必须是数组' })
  @ArrayNotEmpty({ message: '至少提供一张商品主图' })
  @IsString({ each: true, message: '每张商品主图必须是字符串' })
  @Matches(/\S/, { each: true, message: '商品主图地址不能为空' })
  @MaxLength(500, { each: true, message: '商品主图地址不能超过500个字符' })
  mainImage: string[]

  @IsOptional()
  @IsArray({ message: '商品详情图片必须是数组' })
  @IsString({ each: true, message: '每张商品详情图片必须是字符串' })
  detailImages?: string[]

  @IsOptional()
  @IsBoolean({ message: '是否包含基础安装必须是布尔值' })
  installationIncluded?: boolean

  @IsOptional()
  @IsBoolean({ message: '是否上架必须是布尔值' })
  isPublished?: boolean

  @IsOptional()
  @IsInt({ message: '排序值必须是整数' })
  @Min(0, { message: '排序值不能小于0' })
  sort?: number
}

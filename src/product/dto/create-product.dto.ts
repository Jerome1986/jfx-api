import {
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

export class CreateProductDto {
  @IsInt({ message: '商品分类ID必须是整数' })
  @Min(1, { message: '商品分类ID必须大于0' })
  categoryId: number

  @IsString({ message: '商品名称必须是字符串' })
  @IsNotEmpty({ message: '商品名称不能为空' })
  name: string

  @IsOptional()
  @IsString({ message: '商品描述必须是字符串' })
  description?: string

  @IsOptional()
  @IsString({ message: '品牌必须是字符串' })
  brand?: string

  @IsOptional()
  @IsString({ message: '产品型号必须是字符串' })
  model?: string

  @IsOptional()
  @IsArray({ message: '商品规格必须是数组' })
  @IsString({ each: true, message: '每个商品规格必须是字符串' })
  specifications?: string[]

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: '销售价必须是最多保留两位小数的数字' },
  )
  @Min(0, { message: '销售价不能小于0' })
  @Max(99999999.99, { message: '销售价不能大于99999999.99' })
  price: number

  @IsOptional()
  @IsInt({ message: '库存必须是整数' })
  @Min(0, { message: '库存不能小于0' })
  stock?: number

  @IsString({ message: '商品主图必须是字符串' })
  @IsNotEmpty({ message: '商品主图不能为空' })
  mainImage: string

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

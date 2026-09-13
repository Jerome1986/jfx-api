import { Transform } from 'class-transformer'
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator'

export class QueryProductDto {
  @IsOptional()
  @IsString({ message: '商品关键字必须是字符串' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  keyword?: string

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  )
  @IsInt({ message: '商品分类ID必须是整数' })
  @Min(1, { message: '商品分类ID必须大于0' })
  categoryId?: number

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  @IsBoolean({ message: '上架状态必须是true或false' })
  isPublished?: boolean

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  @IsBoolean({ message: '库存筛选必须是true或false' })
  inStock?: boolean

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  )
  @IsInt({ message: '页码必须是整数' })
  @Min(1)
  @Max(2147483647)
  pageNum?: number

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  )
  @IsInt({ message: '每页数量必须是整数' })
  @Min(1)
  @Max(100, { message: '每页数量不能超过100' })
  pageSize?: number
}

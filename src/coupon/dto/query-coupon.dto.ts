import { Transform } from 'class-transformer'
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { CouponStatus } from '../../../generated/prisma/enums'

export class QueryCouponDto {
  /** 按优惠券名称模糊搜索。 */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: '搜索关键字必须是字符串' })
  keyword?: string

  @IsOptional()
  @IsEnum(CouponStatus, {
    message: '优惠券模板状态只能是DRAFT、PUBLISHED或DISABLED',
  })
  status?: CouponStatus

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  )
  @IsInt({ message: '页码必须是整数' })
  @Min(1, { message: '页码不能小于1' })
  @Max(2147483647, { message: '页码不能大于2147483647' })
  pageNum?: number

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  )
  @IsInt({ message: '每页数量必须是整数' })
  @Min(1, { message: '每页数量不能小于1' })
  @Max(100, { message: '每页数量不能超过100' })
  pageSize?: number
}

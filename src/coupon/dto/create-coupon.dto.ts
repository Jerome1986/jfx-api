import { Transform } from 'class-transformer'
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator'
import { CouponScopeType, CouponStatus } from '../../../generated/prisma/enums'

export class CreateCouponDto {
  /** 优惠券名称。 */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: '优惠券名称必须是字符串' })
  @IsNotEmpty({ message: '优惠券名称不能为空' })
  name: string

  /** 优惠券面额，单位：元。 */
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: '优惠券面额必须是最多保留两位小数的数字' },
  )
  @Min(0.01, { message: '优惠券面额不能小于0.01元' })
  @Max(99999999.99, { message: '优惠券面额不能大于99999999.99元' })
  amount: number

  /** 使用门槛，单位：元；不传时默认为0，表示无门槛。 */
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: '使用门槛必须是最多保留两位小数的数字' },
  )
  @Min(0, { message: '使用门槛不能小于0元' })
  @Max(99999999.99, { message: '使用门槛不能大于99999999.99元' })
  threshold?: number

  /** 适用业务范围：全部、装修、商品；不传时默认为ALL（全部）。 */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEnum(CouponScopeType, {
    message: '适用范围只能是ALL（全部）、RENOVATION（装修）或PRODUCT（商品）',
  })
  scopeType?: CouponScopeType

  /** 有效期开始时间，ISO 8601格式。 */
  @IsDateString({ strict: true }, { message: '有效期开始时间必须是有效的ISO 8601日期时间' })
  validFrom: string

  /** 有效期结束时间，须晚于开始时间，由服务层校验。 */
  @IsDateString({ strict: true }, { message: '有效期结束时间必须是有效的ISO 8601日期时间' })
  validTo: string

  /** 发行总量。已发行数量由系统维护，不接受客户端传入。 */
  @IsInt({ message: '发行总量必须是整数' })
  @Min(1, { message: '发行总量必须大于0' })
  @Max(2147483647, { message: '发行总量不能大于2147483647' })
  totalQuantity: number

  /** 每人限领数量，不传时默认为1。 */
  @IsOptional()
  @IsInt({ message: '每人限领数量必须是整数' })
  @Min(1, { message: '每人限领数量必须大于0' })
  @Max(2147483647, { message: '每人限领数量不能大于2147483647' })
  perUserLimit?: number

  /** 模板状态，不传时默认为DRAFT（草稿）。 */
  @IsOptional()
  @IsEnum(CouponStatus, {
    message: '优惠券模板状态只能是DRAFT、PUBLISHED或DISABLED',
  })
  status?: CouponStatus
}

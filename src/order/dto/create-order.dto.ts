import { Transform, Type } from 'class-transformer'
import {
  ArrayNotEmpty, IsArray, IsInt, IsNotEmpty,
  IsOptional, IsString, IsDateString, Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator'

/** 当前商品均包安装，安装标记和费用由服务端确定，无需客户端传入。 */
export class CreateOrderItemDto {
  @IsInt({ message: '商品ID必须是整数' })
  @Min(1, { message: '商品ID必须大于0' })
  @Max(2147483647, { message: '商品ID不能大于2147483647' })
  productId: number

  @IsInt({ message: '购买数量必须是整数' })
  @Min(1, { message: '购买数量必须大于0' })
  @Max(2147483647, { message: '购买数量不能大于2147483647' })
  quantity: number

  /** 所选规格，由服务层校验是否属于该商品。 */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: '商品规格必须是字符串' })
  @IsNotEmpty({ message: '商品规格不能为空' })
  @MaxLength(191, { message: '商品规格不能超过191个字符' })
  skuDescription?: string
}

/** 用户ID取自登录身份；订单编号、金额和支付状态由服务端确定。 */
export class CreateOrderDto {
  /** Beijing calendar date, YYYY-MM-DD; required before payment. */
  @IsDateString({ strict: true })
  @Matches(/^[1-9]\d{3}-\d{2}-\d{2}$/)
  appointmentDate: string

  /** Beijing time range, e.g. 09:00-12:00. */
  @IsString()
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d-(?:[01]\d|2[0-3]):[0-5]\d$/)
  timeSlot: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: '来源渠道必须是字符串' })
  @IsNotEmpty({ message: '来源渠道不能为空' })
  @MaxLength(191, { message: '来源渠道不能超过191个字符' })
  source?: string

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: '联系人姓名必须是字符串' })
  @IsNotEmpty({ message: '联系人姓名不能为空' })
  @MaxLength(50, { message: '联系人姓名不能超过50个字符' })
  contactName: string

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: '联系电话必须是字符串' })
  @IsNotEmpty({ message: '联系电话不能为空' })
  @MaxLength(30, { message: '联系电话不能超过30个字符' })
  contactPhone: string

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: '服务地址必须是字符串' })
  @IsNotEmpty({ message: '服务地址不能为空' })
  @MaxLength(191, { message: '服务地址不能超过191个字符' })
  serviceAddress: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: '订单备注必须是字符串' })
  @MaxLength(191, { message: '订单备注不能超过191个字符' })
  remark?: string

  @IsArray({ message: '商品明细必须是数组' })
  @ArrayNotEmpty({ message: '至少选择一件商品' })
  @ValidateNested({ each: true, message: '商品明细格式不正确' })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[]

  /** 用户已领取的优惠券ID，不是模板ID。 */
  @IsOptional()
  @IsInt({ message: '用户优惠券ID必须是整数' })
  @Min(1, { message: '用户优惠券ID必须大于0' })
  @Max(2147483647, { message: '用户优惠券ID不能大于2147483647' })
  userCouponId?: number

  /** 不传或传0表示不使用积分；余额与抵扣额度由服务层校验。 */
  @IsOptional()
  @IsInt({ message: '使用积分数量必须是整数' })
  @Min(0, { message: '使用积分数量不能小于0' })
  @Max(2147483647, { message: '使用积分数量不能大于2147483647' })
  pointsUsed?: number
}

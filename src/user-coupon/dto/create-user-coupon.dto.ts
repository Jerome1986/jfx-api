import { IsDefined, IsInt, Max, Min } from 'class-validator'

/** 给指定用户发放一张优惠券；状态、领取时间和过期时间由服务端确定。 */
export class CreateUserCouponDto {
  /** 领取优惠券的用户ID。 */
  @IsDefined({ message: '用户ID不能为空' })
  @IsInt({ message: '用户ID必须是整数' })
  @Min(1, { message: '用户ID必须大于0' })
  @Max(2147483647, { message: '用户ID不能大于2147483647' })
  userId: number

  /** 要发放的优惠券模板ID。 */
  @IsDefined({ message: '优惠券模板ID不能为空' })
  @IsInt({ message: '优惠券模板ID必须是整数' })
  @Min(1, { message: '优惠券模板ID必须大于0' })
  @Max(2147483647, { message: '优惠券模板ID不能大于2147483647' })
  couponId: number
}

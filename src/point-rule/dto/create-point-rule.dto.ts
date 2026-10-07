import { IsBoolean, IsInt, IsString, Matches, Max, Min } from 'class-validator'

// 对齐 Decimal(10, 2)：最多八位整数、两位小数，且不能为零。
const POSITIVE_AMOUNT_PATTERN = /^(?!0+(?:\.0+)?$)(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/

/** 开关关闭时仍须提交有效比例；版本和操作人由服务端维护。 */
export class CreatePointRuleDto {
  /** 是否开启购物赠送积分。 */
  @IsBoolean({ message: '购物赠送开关必须是布尔值' })
  rewardEnabled: boolean

  /** 每实付多少元赠送积分，以金额字符串传入。 */
  @IsString({ message: '奖励金额必须是字符串' })
  @Matches(POSITIVE_AMOUNT_PATTERN, { message: '奖励金额必须大于0，最多两位小数，且不能超过99999999.99元' })
  rewardYuan: string

  /** 对应赠送积分。 */
  @IsInt({ message: '奖励积分必须是整数' })
  @Min(1, { message: '奖励积分必须大于0' })
  @Max(2147483647, { message: '奖励积分不能大于2147483647' })
  rewardPoints: number

  /** 是否开启积分抵扣。 */
  @IsBoolean({ message: '积分抵扣开关必须是布尔值' })
  deductEnabled: boolean

  /** 每次兑换所需积分。 */
  @IsInt({ message: '抵扣积分必须是整数' })
  @Min(1, { message: '抵扣积分必须大于0' })
  @Max(2147483647, { message: '抵扣积分不能大于2147483647' })
  deductPoints: number

  /** 对应抵扣金额，以金额字符串传入。 */
  @IsString({ message: '抵扣金额必须是字符串' })
  @Matches(POSITIVE_AMOUNT_PATTERN, { message: '抵扣金额必须大于0，最多两位小数，且不能超过99999999.99元' })
  deductYuan: string

  /** 单笔抵扣上限百分比，20 表示 20%。 */
  @IsInt({ message: '抵扣上限必须是整数' })
  @Min(0, { message: '抵扣上限不能小于0' })
  @Max(100, { message: '抵扣上限不能大于100' })
  limit: number
}

import type { Prisma } from '../../../generated/prisma/client'

/** 服务层校验后的创建参数，仓储无需再次解析请求DTO。 */
export interface PreparedOrder {
  data: Prisma.ProductOrderCreateInput
  userId: number
  /** 从用户表读取，供事务提交后创建微信支付单使用。 */
  openid: string
  userCouponId?: number
  pointsUsed: number
  /** 已合并同一商品的数量，并按商品ID升序排列。 */
  stockItems: { productId: number; quantity: number }[]
}

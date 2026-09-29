// 支付时限固定为创建后 30 分钟，继续付款不延长时限。
export const PAYMENT_TIMEOUT_MS = 30 * 60 * 1000
export const PAYMENT_TIMEOUT_REASON = '支付超时，订单已关闭'
// 根据订单创建时间计算付款截止时间，固定为创建后 30 分钟。
export const paymentExpiresAt = (createdAt: Date) => new Date(createdAt.getTime() + PAYMENT_TIMEOUT_MS)
// 判断订单付款时限是否已到，默认使用当前时间，恰好到截止时间也视为超时。
export const paymentExpired = (createdAt: Date, now = new Date()) => paymentExpiresAt(createdAt) <= now

// 保留原订单字段并补充付款截止时间；仅待付款订单标记是否已超时。
export const withPaymentDeadline = <T extends { createdAt: Date; status: string }>(order: T) => ({
  ...order,
  paymentExpiresAt: paymentExpiresAt(order.createdAt),
  paymentExpired: order.status === 'PENDING_PAYMENT' && paymentExpired(order.createdAt),
})

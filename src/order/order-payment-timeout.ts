// 支付时限固定为创建后 30 分钟，继续付款不延长时限。
export const PAYMENT_TIMEOUT_MS = 30 * 60 * 1000
export const PAYMENT_TIMEOUT_REASON = '支付超时，订单已关闭'
export const paymentExpiresAt = (createdAt: Date) => new Date(createdAt.getTime() + PAYMENT_TIMEOUT_MS)
export const paymentExpired = (createdAt: Date, now = new Date()) => paymentExpiresAt(createdAt) <= now

export const withPaymentDeadline = <T extends { createdAt: Date; status: string }>(order: T) => ({
  ...order,
  paymentExpiresAt: paymentExpiresAt(order.createdAt),
  paymentExpired: order.status === 'PENDING_PAYMENT' && paymentExpired(order.createdAt),
})
